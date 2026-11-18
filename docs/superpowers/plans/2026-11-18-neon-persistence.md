# Neon persistence for online rooms

User authorizes integrating the supplied Neon database. Keep credentials only in ignored backend environment; no frontend DB connection, account system, ORM or hosting deployment.

1. Add validated authority checkpoints including the bounded command-reply cache. Restore without rerolling; retry of an acknowledged command after restart must return the original reply.
2. Add PostgreSQL storage using pg, parameterized SQL and TLS. Add only application-owned tables. Keep per-room JSON checkpoints and a fenced, expiring single-backend lease, compatible with Neon transaction pooling. Never overwrite data from an expired/second writer. Commit changed rooms atomically; acknowledge/broadcast only after durable commit.
3. Integrate queued room mutations, deferred socket effects and rollback on persistence failure. Restore all members as disconnected on restart, retain hashed resume proofs, wait for all living players to reconnect. Preserve normal graceful shutdown games when persistence is configured. Keep explicit in-memory mode for tests/local use without DATABASE_URL.
4. Load backend-only DATABASE_URL from ignored .env using Node's built-in env-file support; retain build:web with no database requirement. Update health/errors, README/runbook and example environment. Add local restart/failure/concurrency regressions and an opt-in live Neon integration test.
5. Connect to the provided database, initialize additive tables, verify save/restart/resume/dedupe, run relevant checks and scan tracked files/web output for credential leakage. Do not deploy, change unrelated DB data or silently claim a multi-instance/Vercel backend.

Acceptance: online room/game/proofs survive backend restart; committed money changes are neither lost nor applied twice; database failure emits no uncommitted state; a second backend cannot mutate the same saved rooms; offline/PWA remain independent.
