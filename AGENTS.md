# AGENTS.md instructions for `/home/christoph.pirkl/git/exasol-driver-ts`

## Context7

Use Context7 MCP to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service. This includes well-known tools such as React, Next.js, Prisma, Express, Tailwind, Django, and Spring Boot.

Use Context7 for:

- API syntax
- configuration
- version migration
- library-specific debugging
- setup instructions
- CLI tool usage

Prefer Context7 over web search for library documentation.

Do not use Context7 for:

- refactoring
- writing scripts from scratch
- debugging business logic
- code review
- general programming concepts

### Workflow

1. Start with `resolve-library-id` using the library name and the user's question, unless the user already provides an exact library ID in `/org/project` format.
2. Pick the best matching library ID by checking exact name match, description relevance, code snippet count, source reputation, and benchmark score.
3. If the first results are weak, retry with alternate names or a rephrased query.
4. Run `query-docs` with the selected library ID and the user's full question.
5. Answer using the fetched documentation.

## OpenFastTrace Skill

For spec-driven development work in this repository, use the upstream OpenFastTrace skill as the reference workflow:

- `https://raw.githubusercontent.com/itsallcode/openfasttrace/refs/heads/main/.agents/skills/openfasttrace-spec-driven-development/SKILL.md`

Repository note: this project's specification documents are located under `doc/spec/`.
