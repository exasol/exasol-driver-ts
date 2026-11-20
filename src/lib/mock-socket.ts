/* eslint-disable @typescript-eslint/no-explicit-any */

import { ExaWebsocket, ReadyState } from "./connection";
import { WebsocketFactory } from "./sql-client";
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

/** How a mocked WebSocket behaves after creation. `hang` never opens nor fails. */
export type MockSocketBehavior = 'open' | 'error' | 'close' | 'hang';

/**
 * Mock factory that creates one {@link MockExaWebSocket} per URL and simulates opening or failing it asynchronously.
 * Use it to test connecting to multiple hosts.
 */
export class MultiHostMockWebsocketFactory {
  public readonly urls: string[] = [];
  public readonly sockets: MockExaWebSocket[] = [];

  constructor(
    private readonly behaviors: Record<string, MockSocketBehavior>,
    private readonly defaultBehavior: MockSocketBehavior = 'error',
  ) {}

  public get factory(): WebsocketFactory {
    return (url: string) => {
      const socket = new MockExaWebSocket();
      this.urls.push(url);
      this.sockets.push(socket);
      const behavior = this.behaviors[url] ?? this.defaultBehavior;
      if (behavior !== 'hang') {
        setTimeout(() => {
          if (behavior === 'open') {
            socket.onopen?.(undefined);
          } else if (behavior === 'error') {
            socket.onerror?.({ message: 'connection refused' });
          } else {
            socket.onclose?.({ code: 1006, reason: 'abnormal closure' });
          }
        }, 0);
      }
      return socket;
    };
  }
}
