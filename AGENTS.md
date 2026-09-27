# AGENTS.md — ube-kosen-map

## Governance
- Constitution: [`constitution/CONSTITUTION.md`](constitution/CONSTITUTION.md)
- Operating Model: [`organization/profiles/release-driven-solo.md`](organization/profiles/release-driven-solo.md)

## Project boundaries
- Preserve the distinction between map/content data and UI/rendering implementation.
- Use repository Vite/TypeScript scripts/config as source-validation authority.
- Browser/map interaction evidence is separate from source-only validation.
- Bun in mise is Agent Skills tooling unless explicitly adopted for the application package manager.

## Delivery
- durable work: GitHub Issue.
- ticket branch: Issue number.
- ticket PR: current release branch.
- normal main integration: release PR only.
- landing: merge commit only.
