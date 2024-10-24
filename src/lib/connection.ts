import { SQLResponse } from './types';
import { Cancelable } from './sql-client.interface';
import { IConnection } from './pool/pool';
import { ILogger } from './logger/logger';
import { ErrClosed, ErrInvalidConn, ErrJobAlreadyRunning, ErrMalformedData } from './errors/errors';
import { AbortQueryCommand, Commands, CommandsNoResult, DisconnectCommand } from './commands';

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
  send(data: string, cb?: (err?: Error) => void): void;
  close(): void;
  readonly readyState: number;
}

const OPEN = 1;
/** The connection is in the process of closing. */
const CLOSING = 2;
/** The connection is closed. */
const CLOSED = 3;

export class Connection implements IConnection {
  private isInUse = false;
  private isBroken = false;

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
  ) {}

  async close() {
    if (this.connection && this.connection.readyState === OPEN) {
      try {
        await this.sendCommand(new DisconnectCommand());
      } catch (error) {
        this.logger.warn(`[Connection:${this.name}] Graceful closing failed`);
      }
    }
    this.connection.onerror = null;
    this.connection.onclose = null;
    this.connection.close();
    this.logger.debug(`[Connection:${this.name}] Closed connection`);
  }

  async sendCommandWithNoResult(cmd: CommandsNoResult) {
    if (!this.connection || this.connection.readyState === CLOSED || this.connection.readyState === CLOSING) {
      this.isBroken = true;
      return Promise.reject(ErrClosed);
    }

    this.logger.debug('[WebSQL]: Send request with no result:', cmd);
    this.connection.send(JSON.stringify(cmd));
    return;
  }

  public sendCommand<T>(cmd: Commands, getCancel?: (cancel?: Cancelable) => void): Promise<SQLResponse<T>> {
    if (!this.connection || this.connection.readyState === CLOSED || this.connection.readyState === CLOSING) {
      this.isBroken = true;
      return Promise.reject(ErrClosed);
    }

    const cancelQuery = () => {
      this.sendCommandWithNoResult(new AbortQueryCommand());
    };

    getCancel && getCancel(cancelQuery);

    return new Promise<SQLResponse<T>>((resolve, reject) => {
      if (this.connection === undefined) {
        this.isBroken = true;
        reject(ErrInvalidConn);
      } else {
        this.connection.onmessage = (event: { data: string }) => {
          this.active = false;

          const data = JSON.parse(event.data) as SQLResponse<T>;
          this.logger.debug(`[Connection:${this.name}] Received data`);

          if (data.status !== 'ok') {
            this.logger.warn(`[Connection:${this.name}] Received invalid data or error`);

            if (data.exception) {
              resolve(data);
            } else {
              reject(ErrMalformedData);
            }

            return;
          }
          resolve(data);
        };

        if (this.active === true) {
          reject(ErrJobAlreadyRunning);
          return;
        }
        this.logger.trace(`[Connection:${this.name}] Send request:`, cmd);

        this.connection.send(JSON.stringify(cmd));
      }
    });
  }
}
