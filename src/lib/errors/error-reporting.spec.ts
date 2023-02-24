import { ExaErrorBuilder } from './error-reporting';

describe('ExaErrorBuilder', () => {
  it.each`
    message                                                 | parsed                                                                                 | args
    ${'my error message'}                                   | ${'TEST: my error message'}                                                            | ${[]}
    ${'my error message with placeholder {{test}}'}         | ${"TEST: my error message with placeholder 'replaced text'"}                           | ${['replaced text']}
    ${'my error message with unknown placeholder {{test}}'} | ${"TEST: my error message with unknown placeholder <UNKNOWN PLACEHOLDER('{{test}}')>"} | ${[]}
  `(
    // eslint-disable-next-line quotes
    `a11y should work for "$message"`,
    async ({ message, parsed, args }: { message: string; parsed: string; args: string[] }) => {
      expect(new ExaErrorBuilder('TEST').message(message, ...args).toString()).toEqual(parsed);
    }
  );

  it.each`
    message                                                  | parsed                                                                                                                  | args
    ${'my error message.'}                                   | ${'TEST: my error message. Please do this instead of that.'}                                                            | ${[]}
    ${'my error message with placeholder {{test}}.'}         | ${"TEST: my error message with placeholder 'replaced text'. Please do this instead of that."}                           | ${['replaced text']}
    ${'my error message with unknown placeholder {{test}}.'} | ${"TEST: my error message with unknown placeholder <UNKNOWN PLACEHOLDER('{{test}}')>. Please do this instead of that."} | ${[]}
  `(
    // eslint-disable-next-line quotes
    `a11y should work for "$message" with mitigation`,
    async ({ message, parsed, args }: { message: string; parsed: string; args: string[] }) => {
      expect(
        new ExaErrorBuilder('TEST')
          .message(message, ...args)
          .mitigation('Please do this instead of that.')
          .toString()
      ).toEqual(parsed);
    }
  );

  it('should return error object', () => {
    const err = new ExaErrorBuilder('TEST').message('Error test').mitigation('Please do this instead of that.').error();
    expect(err.message).toEqual('TEST: Error test Please do this instead of that.');
    expect(err.name).toEqual('ExaError');
  });
});
