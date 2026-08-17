# Security

Do not commit API keys, service-account JSON, NicheWave tokens, or customer data. Local examples and tests must use synthetic data.

As of the 2026-08-17 scaffold, `npm audit --omit=dev` reports transitive advisories under the current Google ADK dependency tree, including ADK's SQLite/dev-runtime chain and telemetry packages. `npm audit fix` applies all available non-breaking updates; npm's remaining suggested force-fix would downgrade ADK to 1.2.0 and is intentionally not applied. Recheck this before deployment and update when upstream patched releases are available.

Report suspected vulnerabilities privately to the repository maintainers rather than opening a public issue with exploit details.
