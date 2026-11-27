/* eslint-disable @typescript-eslint/no-explicit-any */

import { ExaWebsocket, ReadyState } from "./connection";
import { WebsocketFactory, WebsocketOptions } from "./sql-client";
import { SQLQueriesResponse } from "./types";


export class MockExaWebSocket implements ExaWebsocket {
  private mockedReadyState: ReadyState = ReadyState.OPEN;
  public readonly sentCommands: unknown[] = [];
  public closed: boolean = false;
  onmessage: ((event: any) => void) | null = null;
  onopen: ((event: any) => void) | null = null;
  onclose: ((this: any, ev: unknown) => unknown) | null = null;
  onerror: ((this: any, ev: unknown) => unknown) | null = null;
  public send(data: string | Uint8Array): void {
    const command = JSON.parse(data.toString());
    this.sentCommands.push(command);
    if (command.accessToken === 'silent-token') {
      // Simulates a server that never answers the login.
      return;
    }
    if (command.accessToken === 'rejected-token') {
      setTimeout(() => {
        this.callOnMessage({
          data: JSON.stringify({ status: 'error', exception: { sqlCode: '08004', text: 'authentication failed' } }),
        });
      }, 0);
      return;
    }
    const responseData = this.getResponseForCommand(command);
    if (responseData === undefined) {
      return;
    }
    setTimeout(() => {
      this.callOnMessage({
        data: JSON.stringify({
          status: 'ok',
          responseData,
        }),
      });
    }, 0);
  }

  private getResponseForCommand(command: any): any {
    if (command.accessToken == 'access-token') {
      return { sessionID: 123 }
    }
    switch (command.command) {
      case 'loginToken':
        return {};
      case 'execute':
        return this.getMockResultForSQL(command.sqlText);
      case 'executeBatch':
        return this.getMockResultForSQL(command.sqlTexts[0]);
      case 'fetch':
        return { numRows: 1, data: [[2]] };
      case 'abortQuery':
        // No response expected
        return undefined;
      case 'closeResultSet':
        return { "status": "ok" };
      default:
        throw new Error(`MockExaWebSocket: No mock response defined for command '${command.command}'.`);
    }
  }

  private getMockResultForSQL(sqlText: string): SQLQueriesResponse {
    if (sqlText === 'select 1') {
      return {
        numResults: 1,
        results: [{
          resultType: 'resultSet',
          resultSet: {
            numColumns: 1, numRows: 1, numRowsInMessage: 1,
            columns: [{ name: 'A', dataType: { type: 'INTEGER' } }],
            data: [[1]]
          },
        }],
      };
    } else if (sqlText === 'select with multiple rows') {
      return {
        numResults: 1,
        results: [{
          resultType: 'resultSet',
          resultSet: {
            resultSetHandle: 17,
            numColumns: 1,
            numRows: 2,
            numRowsInMessage: 1,
            columns: [{ name: 'A', dataType: { type: 'INTEGER' } }],
            data: [[1]],
          },
        }],
      };
    } else if (sqlText === 'create table test (id int)') {
      return {
        numResults: 1,
        results: [{ resultType: 'rowCount', rowCount: 1 }]
      };
    } else {
      throw new Error(`MockExaWebSocket: No mock response defined for SQL command '${sqlText}'.`);
    }
  }


  public close(): void {
    this.closed = true;
  }
  public get readyState(): ReadyState {
    return this.mockedReadyState;
  }
  public set readyState(state: ReadyState) {
    this.mockedReadyState = state;
  }


  public simulateOpen() {
    if (this.onopen) {
      this.onopen(undefined);
    } else {
      throw new Error('onopen handler is not set in MockExaWebSocket.');
    }
  }

  public callOnMessage(event: any) {
    if (this.onmessage) {
      this.onmessage(event);
    } else {
      throw new Error('onmessage handler is not set in MockExaWebSocket.');
    }
  }

  public callOnClose(event: any) {
    if (this.onclose) {
      this.onclose(event);
    } else {
      throw new Error('onclose handler is not set in MockExaWebSocket.');
    }
  }

  public callOnError(event: any) {
    if (this.onerror) {
      this.onerror(event);
    } else {
      throw new Error('onerror handler is not set in MockExaWebSocket.');
    }
  }
}

export class MockWebsocketFactory {
  public readonly mockSocket: MockExaWebSocket;
  public url: string | undefined;

  constructor() {
    this.mockSocket = new MockExaWebSocket();
    this.url = undefined;
  }

  public get factory(): WebsocketFactory {
    return (url: string) => {
      if (this.url === undefined) {
        this.url = url;
      } else {
        throw new Error(`MockWebsocketFactory: A websocket has already been created with URL ${this.url}. Multiple connections are not supported in this mock factory.`);
      }
      return this.mockSocket;
    };
  }
}

export function createMockWebsocketFactory(): MockWebsocketFactory {
  return new MockWebsocketFactory();
}

/**
 * How a mocked WebSocket behaves after creation. `hang` never opens nor fails. `untrusted-certificate` fails with an
 * error event like `ws` does when Node.js rejects a self-signed server certificate.
 */
export type MockSocketBehavior = 'open' | 'error' | 'untrusted-certificate' | 'expired-certificate' | 'close' | 'hang';

/**
 * Mock of a `ws` WebSocket that reports the server certificate in its `upgrade` event, like `ws` does after the
 * TLS handshake.
 */
export class MockWsWebSocket extends MockExaWebSocket {
  private readonly upgradeListeners: Array<(response: unknown) => void> = [];

  public once(event: string, listener: (response: unknown) => void): this {
    if (event === 'upgrade') {
      this.upgradeListeners.push(listener);
    }
    return this;
  }

  /** Emits `upgrade` with a TLS socket whose certificate has the given `fingerprint256`, or no certificate. */
  public emitUpgrade(fingerprint256: string | undefined) {
    const certificate = fingerprint256 === undefined ? {} : { fingerprint256 };
    const listeners = this.upgradeListeners.splice(0);
    listeners.forEach((listener) => listener({ socket: { getPeerCertificate: () => certificate } }));
  }
}

/**
 * Server certificate of a mocked `ws` WebSocket: a `fingerprint256` (`AB:CD:...`) reported in the `upgrade` event,
 * `''` for an `upgrade` event without certificate, or `null` for a WebSocket that never emits `upgrade`.
 */
export type MockCertificate = string | null;

/**
 * Mock factory that creates one {@link MockExaWebSocket} per URL and simulates opening or failing it asynchronously.
 * Use it to test connecting to multiple hosts. URLs with a certificate get a {@link MockWsWebSocket}.
 */
export class MultiHostMockWebsocketFactory {
  public readonly urls: string[] = [];
  public readonly options: WebsocketOptions[] = [];
  public readonly sockets: MockExaWebSocket[] = [];

  constructor(
    private readonly behaviors: Record<string, MockSocketBehavior>,
    private readonly defaultBehavior: MockSocketBehavior = 'error',
    private readonly certificates: Record<string, MockCertificate> = {},
  ) {}

  public get factory(): WebsocketFactory {
    return (url: string, options?: WebsocketOptions) => {
      if (options === undefined) {
        throw new Error('MultiHostMockWebsocketFactory: the driver must pass WebSocket options.');
      }
      const certificate = this.certificates[url];
      const socket = certificate === undefined ? new MockExaWebSocket() : new MockWsWebSocket();
      this.urls.push(url);
      this.options.push(options);
      this.sockets.push(socket);
      const behavior = this.behaviors[url] ?? this.defaultBehavior;
      if (behavior !== 'hang') {
        setTimeout(() => {
          if (behavior === 'open') {
            if (socket instanceof MockWsWebSocket && certificate !== null && certificate !== undefined) {
              socket.emitUpgrade(certificate === '' ? undefined : certificate);
            }
            if (!socket.closed) {
              socket.onopen?.(undefined);
            }
          } else if (behavior === 'error') {
            socket.onerror?.({ message: 'connection refused' });
          } else if (behavior === 'untrusted-certificate') {
            const error = Object.assign(new Error('self-signed certificate'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
            socket.onerror?.({ message: error.message, error });
          } else if (behavior === 'expired-certificate') {
            const error = Object.assign(new Error('certificate has expired'), { code: 'CERT_HAS_EXPIRED' });
            socket.onerror?.({ message: error.message, error });
          } else {
            socket.onclose?.({ code: 1006, reason: 'abnormal closure' });
          }
        }, 0);
      }
      return socket;
    };
  }
}
