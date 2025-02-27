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

  private stringToUint8Array(str: string) : Uint8Array {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i); // Extract byte values
    }
    return bytes;
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
    //TODO: verify this : you "lose" class state here, see this.connection as soon as you step into the promise code below
    //TODO verify this: you can still access the encapsulating function parameters
    return new Promise<SQLResponse<T>>((resolve, reject) => {
      if (this.connection === undefined) {
        this.isBroken = true;
        reject(ErrInvalidConn);
      } else {
        this.connection.onmessage = (event) => {
          //(event: { data: string }) => {
          this.logger.debug(`[OnMessage triggered for :${this.name}]`);
          this.active = false;
          let data :SQLResponse<T>;
          if (this.useCompression) {
            this.logger.debug("Using compression");
            //const eventDataStr : string = event.data;

            //const encoder = new TextEncoder();
            //const uint8Array = encoder.encode(eventDataStr);


            //const uint8Array = this.stringToUint8Array(eventDataStr);
            //const deCompressedData = pako.inflate(uint8Array, { to: 'string' })

            //const compressedData = eventDataStr;
            //const textDecoder =  new TextDecoder();
            //const decoded = textDecoder.decode(pako.inflate(compressedData));

            const arrayBuffer = event.data.arrayBuffer(); // Convert Blob to ArrayBuffer
            const decompressed = inflate(new Uint8Array(arrayBuffer));
            const decoded  = new TextDecoder().decode(decompressed);

            data = JSON.parse(decoded) as SQLResponse<T> ;
          } else {
            data = JSON.parse(event.data) as SQLResponse<T>;
          }
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

        this.connection.onerror = (event: unknown) => {
          this.logger.trace("WebSocket error:", event);
      };

        if (this.active === true) {
          reject(ErrJobAlreadyRunning);
          return;
        }
        this.logger.trace(`[Connection:${this.name}] Send request:`, cmd);
        const cmdStr : string = JSON.stringify(cmd);

        if (this.useCompression) {
          //const deflated : Uint8Array = pako.deflate(cmdStr);
          this.logger.debug("Using compression");
          const data = typeof cmdStr === 'string' ? new TextEncoder().encode(cmdStr) : cmdStr;
          const deflatedData = deflate(data);
          this.connection.send(deflatedData); //,this.handleErrorOnSend); 
        }
          else {
          this.logger.debug("Not using compression");
          this.connection.send(cmdStr); //,this.handleErrorOnSend)
        }

      }
    });
  }
}