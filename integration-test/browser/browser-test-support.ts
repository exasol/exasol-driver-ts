import type { Config, WebsocketFactory } from '@exasol/exasol-driver-ts/browser';
import { inject } from 'vitest';
import type { BrowserConnectionSettings } from './global-setup';

export function connectionSettings(): BrowserConnectionSettings {
  return inject('browserConnection' as never) as BrowserConnectionSettings;
}

export function nativeWebSocketFactory(): { factory: WebsocketFactory; urls: string[] } {
  const urls: string[] = [];
  return {
    factory: (url: string) => {
      urls.push(url);
      return new WebSocket(url) as ReturnType<WebsocketFactory>;
    },
    urls,
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
