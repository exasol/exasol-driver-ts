import { CloseResultSetCommand } from './commands';
import { ResponseCommandQueue } from './response-command-queue';

// [utest->dsn~runtime-response-command-serialization~1]
describe('response command queue', () => {
  function createQueue() {
    const send = jest.fn();
    const onSendError = jest.fn();
    return { queue: new ResponseCommandQueue(send, onSendError), send, onSendError };
  }

  it('inactive after creation', () => {
    const { queue } = createQueue();

    expect(queue.active).toBe(false);
  });

  it('sends an enqueued command immediately', () => {
    const { queue, send } = createQueue();
    const command = { command: 'execute' as const, sqlText: 'select 1' };

    void queue.enqueue(command);

    expect(send).toHaveBeenCalledWith(command);
    expect(queue.active).toBe(true);
  });

  it('keeps later commands queued while a command awaits its response', () => {
    const { queue, send } = createQueue();
    const firstCommand = { command: 'execute' as const, sqlText: 'select 1' };
    const secondCommand = new CloseResultSetCommand([17]);

    void queue.enqueue(firstCommand);
    void queue.enqueue(secondCommand);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(firstCommand);
  });

  it('resolves the active command response', async () => {
    const { queue } = createQueue();
    const command = queue.enqueue({ command: 'execute', sqlText: 'select 1' });
    const response = { status: 'ok' as const, exception: undefined, responseData: { result: 1 } };

    queue.resolve(response);

    await expect(command).resolves.toEqual(response);
    expect(queue.active).toBe(false);
  });

  it('sends the next queued command after resolving the active command', async () => {
    const { queue, send } = createQueue();
    const firstCommand = queue.enqueue({ command: 'execute', sqlText: 'select 1' });
    const secondCommand = queue.enqueue(new CloseResultSetCommand([17]));

    queue.resolve({ status: 'ok', exception: undefined, responseData: { result: 1 } });

    await expect(firstCommand).resolves.toBeDefined();
    expect(send).toHaveBeenLastCalledWith(new CloseResultSetCommand([17]));
    queue.rejectAll(new Error('test cleanup'));
    await expect(secondCommand).rejects.toThrow('test cleanup');
  });

  it('rejects the active command and sends the next queued command', async () => {
    const { queue, send } = createQueue();
    const firstCommand = queue.enqueue({ command: 'execute', sqlText: 'select 1' });
    const secondCommand = queue.enqueue(new CloseResultSetCommand([17]));

    queue.reject(new Error('invalid response'));

    await expect(firstCommand).rejects.toThrow('invalid response');
    expect(send).toHaveBeenLastCalledWith(new CloseResultSetCommand([17]));
    queue.rejectAll(new Error('test cleanup'));
    await expect(secondCommand).rejects.toThrow('test cleanup');
  });

  it('rejects active and queued commands together', async () => {
    const { queue } = createQueue();
    const firstCommand = queue.enqueue({ command: 'execute', sqlText: 'select 1' });
    const secondCommand = queue.enqueue({ command: 'execute', sqlText: 'select 2' });

    queue.rejectAll(new Error('connection lost'));

    await expect(firstCommand).rejects.toThrow('connection lost');
    await expect(secondCommand).rejects.toThrow('connection lost');
    expect(queue.active).toBe(false);
  });

  it('rejects resolving without an active command', () => {
    const { queue } = createQueue();

    expect(() => queue.resolve({ status: 'ok', exception: undefined, responseData: {} })).toThrow('No command is awaiting a response.');
  });

  it('rejects rejecting without an active command', () => {
    const { queue } = createQueue();

    expect(() => queue.reject(new Error('invalid response'))).toThrow('No command is awaiting a response.');
  });

  it('reports a command send failure to the connection owner', () => {
    const sendFailure = new Error('socket failure');
    const send = jest.fn(() => {
      throw sendFailure;
    });
    const onSendError = jest.fn();
    const queue = new ResponseCommandQueue(send, onSendError);

    void queue.enqueue({ command: 'execute', sqlText: 'select 1' });

    expect(onSendError).toHaveBeenCalledWith(sendFailure);
  });
});
