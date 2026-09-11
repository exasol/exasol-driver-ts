import type { Config, WebsocketFactory } from '@exasol/exasol-driver-ts/browser';
import { inject } from 'vitest';
import type { BrowserConnectionSettings } from './global-setup';

export function connectionSettings(): BrowserConnectionSettings {
  return inject('browserConnection' as never) as BrowserConnectionSettings;
}

export function nativeWebSocketFactory(): { factory: WebsocketFactory; urls: string[]; waitForClose: () => Promise<void>; isClosed: () => boolean } {
  const urls: string[] = [];
  let websocket: WebSocket | undefined;
  return {
    factory: (url: string) => {
      urls.push(url);
      websocket = new WebSocket(url);
      return websocket as ReturnType<WebsocketFactory>;
    },
    urls,
    waitForClose: () => {
      if (!websocket || websocket.readyState === WebSocket.CLOSED) {
        return Promise.resolve();
      }
      return new Promise(resolve => websocket?.addEventListener('close', () => resolve(), { once: true }));
    },
    isClosed: () => websocket?.readyState === WebSocket.CLOSED,
  };
}

export function basicAuthConfig(connection: BrowserConnectionSettings): Partial<Config> {
  return {
    host: connection.host,
    port: connection.port,
    user: connection.user,
    password: connection.password,
  };
}

export function schemaName(): string {
  return `TEST_SCHEMA${crypto.randomUUID().replace(/-/g, '')}`;
}
