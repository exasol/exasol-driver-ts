export class ExaError extends Error {
  additionalData?: Array<string | number>;
  constructor(message?: string, additionalData?: Array<string | number>) {
    super(message);
    this.name = 'ExaError';
    this.additionalData = additionalData;
  }
}

export class ExaErrorBuilder {
  private readonly tag: string;
  private _message = '';
  private readonly mitigations: string[] = [];

  constructor(tag: string) {
    this.tag = tag;
  }

  public message(message: string, ...args: Array<string | number>): ExaErrorBuilder {
    const filledMessage = this.fillPlaceholders(message, args);
    this._message += filledMessage;
    return this;
  }

  private fillPlaceholders(message: string, args: Array<string | number>) {
    return message.replace(/{{(.*?)}}/g, (placeholder) => {
      if (args.length > 0) {
        return `'${args.shift()}'`;
      } else {
        return "<UNKNOWN PLACEHOLDER('" + placeholder + "')>";
      }
    });
  }

  public mitigation(mitigation: string, ...args: Array<string | number>): ExaErrorBuilder {
    this.mitigations.push(this.fillPlaceholders(mitigation, args));
    return this;
  }

  public toString(): string {
    let result = this.tag + ': ' + this._message;
    if (this.mitigations.length > 0) {
      result += ' ' + this.mitigations.join(' ');
    }
    return result;
  }

  public error(additionalData?: Array<string | number>): Error {
    return new ExaError(this.toString(), additionalData);
  }
}
