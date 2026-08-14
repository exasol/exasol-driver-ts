# Risks and Technical Debt

This chapter documents known architectural risks, limitations, and technical debt.

## Risks

* Browser bundlers may need configuration to avoid bundling Node-only CSV import modules when browser applications import from the package root.
* The minimum supported Node.js and browser versions are not documented, which can make compatibility promises ambiguous.
* CSV import depends on Exasol import tunnel behavior and local network accessibility; failures may be environment-specific.

## Technical Debt

* Some public API comments still contain older wording and typos.
* No coverage threshold is configured in Jest.

## Open Issues

* Decide whether browser-compatible entry points should be separated from Node-only CSV import functionality.
