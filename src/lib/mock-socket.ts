/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ExaWebsocket, ReadyState } from "./connection";
import { websocketFactory } from "./sql-client";
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
    console.log('MockExaWebSocket.send called with data:', command);
    const responseData = this.getResponseForCommand(command);
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
      return {
        sessionID: 123,
      }
    }
    switch (command.command) {
      case 'loginToken':
        return {};
      case 'execute':
        return {
          numResults: 1,
          results: [
            {
              resultType: 'resultSet',
              resultSet: {
                numColumns: 1,
                numRows: 1,
                numRowsInMessage: 1,
                columns: [
                  {
                    name: 'A',
                    dataType: {
                      type: 'INTEGER',
                    },
                  },
                ],
                data: [
                  [1],
                ],
              },
            },
          ],
        } as SQLQueriesResponse;
      default:
        throw new Error(`MockExaWebSocket: No mock response defined for command '${command.command}'.`);
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


  public simulateOpen(event: any) {
    if (this.onopen) {
      this.onopen(event);
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
}

export class MockWebsocketFactory {
  public readonly mockSocket: MockExaWebSocket;
  public url: string | undefined;

  constructor() {
    this.mockSocket = new MockExaWebSocket();
    this.url = undefined;
  }

  public get factory(): websocketFactory {
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
