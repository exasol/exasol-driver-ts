import { AbortQueryCommand, Commands, CommandsNoResult, DisconnectCommand } from './commands';
import { ErrClosed, ErrNotConnected, MissingExceptionError, newMalformedWebsocketResponseError, newSocketClosedError, newSocketError } from './errors/errors';
import { ILogger } from './logger/logger';
import { PoolItem } from './pool/pool';
import { ResponseCommandQueue } from './response-command-queue';
import { Cancelable } from './sql-client.interface';
import { SQLResponse } from './types';
import { WebsocketProtocol } from './websocket-protocol';

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
  private readonly protocol: WebsocketProtocol;
  private readonly commandQueue = new ResponseCommandQueue(
    (command) => {
      this.logger.trace(`[Connection:${this.name}] Send request:`, command);
      this.protocol.sendCommand(command);
    },
    (cause) => this.breakConnection(newSocketError(cause)),
  );

  public setCompression(compression: boolean) {
    this.protocol.setCompression(compression);
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
    this.protocol = new WebsocketProtocol(websocket);
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
      this.protocol.sendCommand(cmd);
    } catch (error) {
      this.breakConnection(newSocketError(error));
      throw newSocketError(error);
    }
    return;
  }

  private handleSocketMessage(event: ExaMessageEvent) {
    if (!this.commandQueue.active) {
      this.breakConnection(newMalformedWebsocketResponseError());
      return;
    }

    try {
      const data = this.protocol.parseResponse(event.data);
      this.logger.trace(`[Connection:${this.name}] Received data`);
      if (data.status !== 'ok' && !data.exception) {
        this.commandQueue.reject(MissingExceptionError);
      } else {
        this.commandQueue.resolve(data);
      }
    } catch {
      this.breakConnection(newMalformedWebsocketResponseError());
    }
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

    getCancel?.(cancelQuery);

    if (this.connection === undefined) {
      this.isBroken = true;
      return Promise.reject(ErrNotConnected);
    }
    return this.commandQueue.enqueue<T>(cmd);
  } //end of sendCommand
}
