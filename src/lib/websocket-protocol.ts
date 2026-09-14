import { deflate, inflate } from 'pako';
import { Commands } from './commands';
import { SQLResponse } from './types';

export interface WebsocketSender {
  send(data: string | Uint8Array): void;
}

/** Handles encoding and decoding for one WebSocket connection. */
export class WebsocketProtocol {
  private useCompression = false;

  constructor(private readonly websocket: WebsocketSender) {}

  public setCompression(compression: boolean) {
    this.useCompression = compression;
  }

  public sendCommand(command: Commands): void {
    this.websocket.send(this.serializeCommand(command));
  }

  public parseResponse(data: unknown): SQLResponse<unknown> {
    const rawResponse = this.useCompression
      ? new TextDecoder().decode(inflate(new Uint8Array(data as ArrayBuffer)))
      : data;
    if (typeof rawResponse !== 'string') {
      throw new TypeError(`WebSocket response is not text: received ${typeof rawResponse}.`);
    }

    const response = JSON.parse(rawResponse) as SQLResponse<unknown>;
    if (!response || typeof response !== 'object' || (response.status !== 'ok' && response.status !== 'error')) {
      throw new Error(`WebSocket response has an invalid status: received '${String(response?.status)}'.`);
    }
    return response;
  }

  private serializeCommand(command: Commands): string | Uint8Array {
    const data = JSON.stringify(command);
    return this.useCompression ? this.encodeAndCompressData(data) : data;
  }

  private encodeAndCompressData(data: string): Uint8Array {
    return deflate(new TextEncoder().encode(data));
  }
}
