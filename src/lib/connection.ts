import { deflate, inflate } from 'pako';
import { AbortQueryCommand, Commands, CommandsNoResult, DisconnectCommand } from './commands';
import { ErrClosed, ErrNotConnected, MissingExceptionError, newMalformedWebsocketResponseError, newSocketClosedError, newSocketError } from './errors/errors';
import { ILogger } from './logger/logger';
import { PoolItem } from './pool/pool';
import { ResponseCommandQueue } from './response-command-queue';
import { Cancelable } from './sql-client.interface';
import { SQLResponse } from './types';

// [impl->dsn~runtime-browser-websocket~2]
// [impl->dsn~runtime-node-websocket~2]
// [impl->dsn~runtime-inflight-websocket-failure~1]
// [impl->dsn~runtime-response-command-serialization~1]
export interface ExaMessageEvent {
  data: unknown;
  type: string;
  target: unknown;
}

export interface ExaWebsocket {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onmessage: ((event: any) => void) | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onopen: ((event: any) => void) | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onclose: ((this: any, ev: unknown) => unknown) | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onerror: ((this: any, ev: unknown) => unknown) | null;
  send(data: string | Uint8Array): void;
  close(): void;
  readonly readyState: ReadyState;
  binaryType?: 'arraybuffer' | 'blob';
}

export enum ReadyState {
  OPEN = 1,
  /** The connection is in the process of closing. */
  CLOSING = 2,
  /** The connection is closed. */
  CLOSED = 3
}

export class Connection implements PoolItem {
  private isBroken = false;
  private useCompression = false;
  private readonly commandQueue = new ResponseCommandQueue(
    (command) => {
      this.logger.trace(`[Connection:${this.name}] Send request:`, command);
      this.sendCmd(command);
    },
    (cause) => this.breakConnection(newSocketError(cause)),
  );

  public setCompression(compression: boolean) {
    this.useCompression = compression;
  }
  public get active(): boolean {
    return this.commandQueue.active;
  }

  public get connection(): ExaWebsocket {
    return this.websocket;
  }

  public get broken(): boolean {
    return this.isBroken;
  }
  constructor(
    private readonly websocket: ExaWebsocket,
    private readonly logger: ILogger,
    public name: string,
    private readonly onClose?: (event: unknown) => void,
  ) {
    this.websocket = websocket;
    this.logger = logger;
    this.name = name;
    if (this.websocket) {
      this.websocket.binaryType = 'arraybuffer';
      this.websocket.onmessage = (event: ExaMessageEvent) => {
        this.handleSocketMessage(event);
      };
      this.websocket.onclose = (event: unknown) => {
        this.handleSocketClose(event);
      };
      this.websocket.onerror = (event: unknown) => {
        this.handleSocketError(event);
      };
    }
  }

  private handleSocketClose(event: unknown) {
    this.logger.debug('WebSocket close:', event);
    this.onClose?.(event);
    this.breakConnection(newSocketClosedError(event), false);
  }

  private handleSocketError(event: unknown) {
    this.logger.error('WebSocket error:', event);
    this.breakConnection(newSocketError(event));
  }

  async close() {
    if (this.connection?.readyState === ReadyState.OPEN) {
      try {
        await this.sendCommand(new DisconnectCommand());
      } catch (error) {
        this.logger.warn(`[Connection:${this.name}] Graceful closing failed`, error);
      }
    }
    this.cleanupConnection();
    this.logger.trace(`[Connection:${this.name}] Closed connection`);
  }

  private cleanupConnection() {
    this.connection.onmessage = null;
    this.connection.onerror = null;
    this.connection.onclose = null;
    this.connection.close();
  }

  async sendCommandWithNoResult(cmd: CommandsNoResult) {
    if (!this.connection || this.isBroken || this.connection.readyState === ReadyState.CLOSED || this.connection.readyState === ReadyState.CLOSING) {
      this.isBroken = true;
      return Promise.reject(ErrClosed);
    }

    this.logger.trace('[WebSQL]: Send request with no result:', cmd);
    try {
      this.sendCmd(cmd);
    } catch (error) {
      this.breakConnection(newSocketError(error));
      throw newSocketError(error);
    }
    return;
  }

  private encodeAndCompressData(data: string): Uint8Array {
    const encoded = new TextEncoder().encode(data);
    return deflate(encoded);
  }

  private sendCmd(cmd: Commands) {
    const cmdStr: string = JSON.stringify(cmd);

    if (this.useCompression) {
      this.logger.trace('Using compression');
      const deflatedData = this.encodeAndCompressData(cmdStr);
      this.connection.send(deflatedData);
    } else {
      this.logger.trace('Not using compression');
      this.connection.send(cmdStr);
    }
  }

  private handleSocketMessage(event: ExaMessageEvent) {
    if (!this.commandQueue.active) {
      this.breakConnection(newMalformedWebsocketResponseError());
      return;
    }

    try {
      const data = this.parseResponse(event);
      if (data.status !== 'ok' && !data.exception) {
        this.commandQueue.reject(MissingExceptionError);
      } else {
        this.commandQueue.resolve(data);
      }
    } catch {
      this.breakConnection(newMalformedWebsocketResponseError());
    }
  }

  private parseResponse(event: ExaMessageEvent): SQLResponse<unknown> {
    this.logger.trace(`[Entered OnMessage for :${this.name}]`);

    const rawResponse = this.useCompression
      ? new TextDecoder().decode(inflate(new Uint8Array(event.data as ArrayBuffer)))
      : event.data;
    if (typeof rawResponse !== 'string') {
      throw new Error(`WebSocket response is not text: received ${typeof rawResponse}.`);
    }

    const response = JSON.parse(rawResponse) as SQLResponse<unknown>;
    if (!response || typeof response !== 'object' || (response.status !== 'ok' && response.status !== 'error')) {
      throw new Error(`WebSocket response has an invalid status: received '${String(response?.status)}'.`);
    }
    this.logger.trace(`[Connection:${this.name}] Received data`);
    return response;
  }

  private breakConnection(error: Error, closeSocket = true) {
    if (this.isBroken) {
      return;
    }

    this.isBroken = true;
    this.commandQueue.rejectAll(error);
    if (closeSocket) {
      this.cleanupConnection();
    }
  }

  public sendCommand<T>(cmd: Commands, getCancel?: (cancel?: Cancelable) => void): Promise<SQLResponse<T>> {
    // [impl->dsn~runtime-query-cancellation~1]
    if (this.isBroken || this.connection?.readyState === ReadyState.CLOSED || this.connection?.readyState === ReadyState.CLOSING) {
      this.isBroken = true;
      return Promise.reject(ErrClosed);
    }
    this.logger.trace('Entered sendCommand');
    const cancelQuery = () => {
      this.sendCommandWithNoResult(new AbortQueryCommand());
    };
    this.logger.trace(`[useCompression is: ${this.useCompression}]`);

    getCancel?.(cancelQuery);

    if (this.connection === undefined) {
      this.isBroken = true;
      return Promise.reject(ErrNotConnected);
    }
    return this.commandQueue.enqueue<T>(cmd);
  } //end of sendCommand
}
