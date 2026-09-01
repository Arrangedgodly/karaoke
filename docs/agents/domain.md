# Domain docs

This is a single-context repository. The engineering skills must read the repository's domain documentation before exploring or changing the code.

## Before exploring

Read:

- `CONTEXT.md` at the repository root.
- ADRs under `docs/adr/` that touch the area being changed.

If either location is absent, proceed silently. Do not create domain documentation merely because it is missing. The domain-modeling skill creates or updates these files when the project resolves a term or decision.

## Layout

```text
/
├── CONTEXT.md
├── docs/
│   ├── adr/
│   └── agents/
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept in an issue title, specification, refactor proposal, test name, or implementation note, use the term defined in `CONTEXT.md`.

Do not substitute a synonym that the glossary marks under `_Avoid_`.

If a required concept is missing, first check whether existing project language already covers it. If the gap is real, record it through the domain-modeling process.

## Respect ADRs

Read ADRs that govern the area before proposing or implementing a change.

If work would contradict an ADR, state the conflict explicitly. Do not silently override an accepted decision.
