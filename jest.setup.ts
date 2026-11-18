import { TextDecoder, TextEncoder } from 'node:util';

// Node.js 22 does not yet provide the explicit resource-management symbols.
// TypeScript's `await using` helper requires this symbol at runtime.
if (Symbol.asyncDispose === undefined) {
  Object.defineProperty(Symbol, 'asyncDispose', {
    value: Symbol('Symbol.asyncDispose'),
  });
}

// jsdom does not expose the Encoding API used by the browser-compatible RSA package.
if (globalThis.TextEncoder === undefined) {
  Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder });
}
if (globalThis.TextDecoder === undefined) {
  Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder });
}
