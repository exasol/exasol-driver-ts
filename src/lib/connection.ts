import { SQLResponse } from './types';
import { Cancelable } from './sql-client.interface';
import { PoolItem } from './pool/pool';
import { ILogger } from './logger/logger';
import { ErrClosed, ErrInvalidConn, ErrJobAlreadyRunning, ErrMalformedData } from './errors/errors';
import { AbortQueryCommand, Commands, CommandsNoResult, DisconnectCommand } from './commands';
import {deflate,inflate} from 'pako';
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

  public setCompression(compression: boolean){
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
  constructor(private readonly websocket: ExaWebsocket, private readonly logger: ILogger, public name: string) {
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
    const cmdStr : string = JSON.stringify(cmd);

    if (this.useCompression) {
      //const deflated : Uint8Array = pako.deflate(cmdStr);
      this.logger.debug("Using compression");
      const data = typeof cmdStr === 'string' ? new TextEncoder().encode(cmdStr) : cmdStr;
      const deflatedData = deflate(data);
      this.connection.send(deflatedData); //,this.handleErrorOnSend); 
    } else {
      this.logger.debug("Not using compression");
    this.connection.send(cmdStr);
    }
    return;
  }

  // private handleErrorOnSend(err?: Error) {
  //   if (err) {
  //     this.logger.trace("Failed to send data:", err);
  //   } else {
  //     this.logger.trace("Data sent successfully!");
  //   }
  // }

//   private stringToUint8Array(str: string) : Uint8Array {
//     const bytes = new Uint8Array(str.length);
//     for (let i = 0; i < str.length; i++) {
//         bytes[i] = str.charCodeAt(i); // Extract byte values
//     }
//     return bytes;
// }

  public sendCommand<T>(cmd: Commands, getCancel?: (cancel?: Cancelable) => void): Promise<SQLResponse<T>> {
    if (!this.connection || this.connection.readyState === CLOSED || this.connection.readyState === CLOSING) {
      this.isBroken = true;
      return Promise.reject(ErrClosed);
    }
    this.logger.debug("Entered sendCommand");
    const cancelQuery = () => {
      this.sendCommandWithNoResult(new AbortQueryCommand());
    };
    this.logger.debug(`[useCompression is: ${this.useCompression}]`);

    getCancel && getCancel(cancelQuery);
    //TODO: verify this : you "lose" class state here, see this.connection as soon as you step into the promise code below
    //TODO verify this: you can still access the encapsulating function parameters
    return new Promise<SQLResponse<T>>((resolve, reject) => {

      if (this.connection === undefined) {
        this.isBroken = true;
        reject(ErrInvalidConn);
      } else {

        this.connection.onmessage = (event) => {
          
          try {
            this.logger.debug(`[Entered OnMessage for :${this.name}]`);
            this.logger.debug(`[Cmd sent was: ${JSON.stringify(cmd)}]`);
            this.logger.debug(`[Compression enabled: ${this.useCompression}]`);

          this.active = false;
          let data :SQLResponse<T>;
          if (this.useCompression) {
            
            this.logger.debug("inflate");
            const decompressed = inflate(new Uint8Array(event.data));
            this.logger.debug("decode")
            const decoded  = new TextDecoder().decode(decompressed);
            this.logger.debug("parse");
            data = JSON.parse(decoded) as SQLResponse<T> ;
          } else {
            data = JSON.parse(event.data) as SQLResponse<T>;
          }
          this.logger.debug(`[Connection:${this.name}] Received data`);

          if (data.status !== 'ok') {
            this.logger.debug(`[Connection:${this.name}] Received invalid data or error`);

            if (data.exception) {
              resolve(data);
            } else {
              reject(ErrMalformedData);
            }

            return;
          }
          resolve(data);
        } catch (error: unknown) {
          let errorMessage = "Unexpected error in message handling";
          if (error instanceof Error) {
              errorMessage = error.message;
          }
          console.log(`[Unhandled error in onmessage: ${errorMessage}]`);
          reject(new Error(errorMessage));
      }
        };
        //end of onMessage

        this.connection.onerror = (event: unknown) => {
          this.logger.trace("WebSocket error:", event);
      };

      //sendCommand 'resumes'
        if (this.active === true) {
          reject(ErrJobAlreadyRunning);
          return;
        }
        this.logger.debug(`[Connection:${this.name}] Send request:`, cmd);
        const cmdStr : string = JSON.stringify(cmd);
        this.logger.debug(`[useCompression is: ${this.useCompression}]`);

        if (this.useCompression) {
          this.logger.debug("Debug: Using compression");
          const data = typeof cmdStr === 'string' ? new TextEncoder().encode(cmdStr) : cmdStr;
          const deflatedData = deflate(data);
          this.connection.send(deflatedData);
        }
          else {
            this.logger.debug("Debug: Not using compression");
          this.connection.send(cmdStr);
        }

      }
    }); //end of return new promise
  }//end of sendCommand
}