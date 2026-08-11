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
