# AGENTS.md instructions for `/home/christoph.pirkl/git/exasol-driver-ts`

This driver is based on the [Exasol WebSocket API](https://github.com/exasol/websocket-api).

## OpenFastTrace Skill

For spec-driven development work in this repository, use the upstream OpenFastTrace skill as the reference workflow:

- `https://raw.githubusercontent.com/itsallcode/openfasttrace/refs/heads/main/.agents/skills/openfasttrace-spec-driven-development/SKILL.md`

Repository note: this project's specification documents are located under `doc/spec/`.

Run OpenFastTrace verification with:

```sh
npm run trace
```

### User Guide Traceability

Keep `doc/user_guide/user_guide.md` reader-focused: do not add complete OpenFastTrace specification items there. To trace user documentation to a scenario, add an inline HTML comment directly before the relevant guidance:

```md
<!-- [uman->scn~scenario-name~revision] -->
```

When adding such a `uman` coverage tag, include `uman` in the scenario's `Needs` list alongside its design coverage, and list `uman` in the quality-requirements artifact hierarchy.

## Docker Integration Tests

Integration tests require access to the local Docker daemon. Run the full suite with:

```sh
env -u NODE_OPTIONS npm run itest
```

Run this command in an interactive terminal/PTY and wait for the terminal session to exit. In Codex, request elevated Docker access when sandboxing prevents access to the Docker socket. Unsetting `NODE_OPTIONS` avoids interference from the VS Code JavaScript debugger hook.

## Error Codes

Every new error created with `ExaErrorBuilder` must use a unique `E-EDJS-<number>` code. Before assigning a code, search the repository for existing `E-EDJS-` identifiers. Allocate new codes monotonically after the highest code already in use; do not reuse historical gaps.
