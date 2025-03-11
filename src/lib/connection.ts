import { SQLResponse } from './types';
import { Cancelable } from './sql-client.interface';
import { PoolItem } from './pool/pool';
import { ILogger } from './logger/logger';
import { ErrClosed, ErrInvalidConn, ErrJobAlreadyRunning, ErrMalformedData } from './errors/errors';
import { AbortQueryCommand, Commands, CommandsNoResult, DisconnectCommand } from './commands';
import { deflate, inflate } from 'pako';
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
  send(data: string | Uint8Array, cb?: (err?: Error) => void): void;
  close(): void;
  readonly readyState: number;
}

const OPEN = 1;
/** The connection is in the process of closing. */
const CLOSING = 2;
/** The connection is closed. */
const CLOSED = 3;

export class Connection implements PoolItem {
  private isInUse = false;
  private isBroken = false;
  private useCompression = false;

  public setCompression(compression: boolean) {
    this.useCompression = compression;
  }
  public set active(v: boolean) {
    this.isInUse = v;
  }

  public get active(): boolean {
    return this.isInUse;
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
  ) {
    this.websocket = websocket;
    this.logger = logger;
    this.name = name;
  }

  async close() {
    if (this.connection && this.connection.readyState === OPEN) {
      try {
        await this.sendCommand(new DisconnectCommand());
      } catch (error) {
        this.logger.warn(`[Connection:${this.name}] Graceful closing failed`);
      }
    }
    this.cleanupConnection();
    this.logger.trace(`[Connection:${this.name}] Closed connection`);
  }

  private cleanupConnection() {
    this.connection.onerror = null;
    this.connection.onclose = null;
    this.connection.close();
  }

  async sendCommandWithNoResult(cmd: CommandsNoResult) {
    if (!this.connection || this.connection.readyState === CLOSED || this.connection.readyState === CLOSING) {
      this.isBroken = true;
      return Promise.reject(ErrClosed);
    }

    this.logger.trace('[WebSQL]: Send request with no result:', cmd);
    this.sendCmd(cmd);
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

  public sendCommand<T>(cmd: Commands, getCancel?: (cancel?: Cancelable) => void): Promise<SQLResponse<T>> {
    if (!this.connection || this.connection.readyState === CLOSED || this.connection.readyState === CLOSING) {
      this.isBroken = true;
      return Promise.reject(ErrClosed);
    }
    this.logger.trace('Entered sendCommand');
    const cancelQuery = () => {
      this.sendCommandWithNoResult(new AbortQueryCommand());
    };
    this.logger.trace(`[useCompression is: ${this.useCompression}]`);

    getCancel && getCancel(cancelQuery);

    return new Promise<SQLResponse<T>>((resolve, reject) => {
      if (this.connection === undefined) {
        this.isBroken = true;
        reject(ErrInvalidConn);
      } else {
        this.connection.onmessage = (event) => {
          try {
            this.logger.trace(`[Entered OnMessage for :${this.name}]`);
            this.logger.trace(`[Cmd sent was: ${JSON.stringify(cmd)}]`);
            this.logger.trace(`[Compression enabled: ${this.useCompression}]`);

            this.active = false;
            let data: SQLResponse<T>;
            if (this.useCompression) {
              this.logger.trace('inflate');
              const decompressed = inflate(new Uint8Array(event.data));
              this.logger.trace('decode');
              const decoded = new TextDecoder().decode(decompressed);

              this.logger.trace('parse');
              data = JSON.parse(decoded) as SQLResponse<T>;
            } else {
              data = JSON.parse(event.data) as SQLResponse<T>;
            }
            this.logger.trace(`[Connection:${this.name}] Received data`);

            if (data.status !== 'ok') {
              this.logger.trace(`[Connection:${this.name}] Received invalid data or error`);

              if (data.exception) {
                resolve(data);
              } else {
                reject(ErrMalformedData);
              }

              return;
            }
            resolve(data);
          } catch (error: unknown) {
            let errorMessage = 'Unexpected error in message handling';
            if (error instanceof Error) {
              errorMessage = error.message;
            }
            this.logger.error(`[Unhandled error in onmessage: ${errorMessage}]`);
            reject(new Error(errorMessage));
          }
        };
        //end of onMessage

        this.connection.onerror = (event: unknown) => {
          this.logger.error('WebSocket error:', event);
        };

        //sendCommand 'resumes'
        if (this.active === true) {
          reject(ErrJobAlreadyRunning);
          return;
        }
        this.logger.trace(`[Connection:${this.name}] Send request:`, cmd);
        this.sendCmd(cmd);
      }
    }); //end of return new promise
  } //end of sendCommand
}
