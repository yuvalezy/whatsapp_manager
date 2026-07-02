# Documentation

| Guide | What it covers |
| --- | --- |
| [setup.md](./setup.md) | **New installation** — prerequisites, database, `.env`, authentication, first run, optional subsystems, Docker, production hardening. |
| [authentication.md](./authentication.md) | The two credentials (personal forever-JWT login + read-only external API key), the guard decision flow, rotation/revocation, and the security model. |
| [whitelist.md](./whitelist.md) | The allow-list of numbers that get captured — number format, normalization, and management. |

Start with [setup.md](./setup.md) on a fresh machine. The root
[README](../README.md) has the feature tour and troubleshooting; every env var is
documented inline in [`.env.example`](../.env.example).
