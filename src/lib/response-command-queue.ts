import { Commands } from './commands';
import { SQLResponse } from './types';

interface PendingCommand<T> {
  command: Commands;
  resolve: (response: SQLResponse<T>) => void;
  reject: (error: Error) => void;
}

/** Serializes protocol commands because WebSocket responses have no command identifier. */
export class ResponseCommandQueue {
  private pendingCommand: PendingCommand<unknown> | undefined;
  private readonly queuedCommands: PendingCommand<unknown>[] = [];

  constructor(
    private readonly send: (command: Commands) => void,
    private readonly onSendError: (cause: unknown) => void,
  ) {}

  public get active(): boolean {
    return this.pendingCommand !== undefined;
  }

  public enqueue<T>(command: Commands): Promise<SQLResponse<T>> {
    return new Promise<SQLResponse<T>>((resolve, reject) => {
      this.queuedCommands.push({ command, resolve, reject } as PendingCommand<unknown>);
      this.dispatchNext();
    });
  }

  public resolve(response: SQLResponse<unknown>) {
    const pendingCommand = this.pendingCommand;
    if (!pendingCommand) {
      throw new Error('No command is awaiting a response.');
    }
    this.pendingCommand = undefined;
    pendingCommand.resolve(response);
    this.dispatchNext();
  }

  public reject(error: Error) {
    const pendingCommand = this.pendingCommand;
    if (!pendingCommand) {
      throw new Error('No command is awaiting a response.');
    }
    this.pendingCommand = undefined;
    pendingCommand.reject(error);
    this.dispatchNext();
  }

  public rejectAll(error: Error) {
    const pendingCommands = [this.pendingCommand, ...this.queuedCommands];
    this.pendingCommand = undefined;
    this.queuedCommands.length = 0;
    for (const pendingCommand of pendingCommands) {
      pendingCommand?.reject(error);
    }
  }

  private dispatchNext() {
    if (this.pendingCommand) {
      return;
    }
    const pendingCommand = this.queuedCommands.shift();
    if (!pendingCommand) {
      return;
    }
    this.pendingCommand = pendingCommand;
    try {
      this.send(pendingCommand.command);
    } catch (error) {
      this.onSendError(error);
    }
  }
}
