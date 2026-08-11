// Node.js 22 does not yet provide the explicit resource-management symbols.
// TypeScript's `await using` helper requires this symbol at runtime.
if (Symbol.asyncDispose === undefined) {
  Object.defineProperty(Symbol, 'asyncDispose', {
    value: Symbol('Symbol.asyncDispose'),
  });
}
