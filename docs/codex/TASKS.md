# Codex task briefs

Ready-to-paste prompts for Codex (cloud or CLI). Run them **one at a time, in order**. Review and merge each PR before starting the next. Every prompt assumes Codex has read `AGENTS.md` (it does this automatically).

## Before you start (you, not Codex)

1. **Commit the missing frontend files from forge.** A clean clone does not build. See "Known broken state" in `AGENTS.md`. On forge:
   ```bash
   cd ~/forgepanel && git status --short frontend/src
   git add frontend/src/lib/ThemeContext.tsx frontend/src/pages/TestAnimation* frontend/src/pages/Wizard* \
     frontend/src/components/HealthIndicator* frontend/src/components/animations frontend/src/pages/server-tabs/ServerSettings*
   git commit -m "Add frontend files missing from TypeScript migration" && git push
   ```
   Then confirm `cd frontend && npm ci && npm run typecheck && npm run build` passes on a fresh clone.
2. **Codex cloud environment setup script.** Node 20 or 22:
   ```bash
   cd backend && npm ci
   cd ../frontend && npm ci
   ```
   Leave agent internet access **off**. None of these tasks need it.

---

## Task 1: Security review (report only, no code changes)

```
Do a security review of the ForgePanel backend. Do NOT modify any code. Output a single new file, docs/SECURITY_REVIEW.md.

Context: ForgePanel may be offered to third parties. Assume an attacker is either (a) unauthenticated on the network, or (b) a logged-in panel user with permissions on ONE server who wants access to other servers, the host filesystem, or other users' data.

Focus areas, in priority order:
1. Authentication and sessions: backend/auth.js, backend/routes/auth.js. Check login rate limiting, TOTP handling, session fixation, cookie flags, and SESSION_SECRET handling.
2. Authorization: every route in backend/routes/*.js. For each endpoint, check that the per-server permission check exists and matches the action. Produce a table: method, path, required permission, and whether it is actually enforced.
3. File access: backend/routes/files.js, backend/services/sftpService.js, backend/services/pathSafety.js. Check traversal, symlinks pointing outside the data dir, upload size limits, and archive extraction.
4. Config rendering: backend/services/configService.js writes user-supplied field values unescaped into ini/properties/yaml. Check whether a newline in a value can inject extra config keys (e.g. RCON password, admin lists).
5. Command execution: anything using child_process, docker exec, RCON, or steamcmd with user input. child_process is used in services/backupService.js, playitService.js, resourceService.js, schedulerService.js, steamcmd.js and routes/settings.js. Also check servers.js, installService.js, workshopService.js and discordCommands.js.
6. Docker: does any path let a user influence image, binds, privileged, network, or labels? Confirm every container operation filters on the forgepanel=true label.
7. Secrets: Steam API key, Discord token, and S3 credentials. Where are they stored, and are they ever returned by an API response or logged?

For every finding include: severity (Critical/High/Medium/Low), file:line, a concrete exploit scenario, and a proposed fix in 1–3 sentences. Mark anything you could not confirm from the code as "unverified". Do not report generic best practices without a concrete path in this code. End with a prioritized fix list.
```

## Task 2: Fix the Critical and High findings

```
Read docs/SECURITY_REVIEW.md. Fix only the findings marked Critical or High, one commit per finding. For each fix, add a regression test in backend/test/ that fails before the fix and passes after. If a test would need a live Docker daemon, extract the logic into a pure function and test that instead. Update docs/SECURITY_REVIEW.md to mark each finding as fixed, with the commit hash. Follow the Definition of done in AGENTS.md. If any fix would change user-visible behavior or the API, stop and describe the tradeoff instead of picking one.
```

## Task 3: License-key validation (design first, no implementation)

```
ForgePanel's Pro tier is gated by settings.license_tier (backend/services/resourceService.js getTier()), which is just a flag that can be flipped by hand. I want real license keys, without running a license server for now.

Write docs/LICENSING_DESIGN.md comparing at least these options:
(a) offline keys signed with Ed25519 (private key kept by me, public key embedded in the panel; payload = email, tier, expiry, key id)
(b) online activation against a small license API (e.g. Lemon Squeezy or Keygen license APIs)
(c) a hybrid: offline signed keys plus an optional periodic online revocation check

For each option cover: what it protects against, what it doesn't (the code is AGPL and anyone can patch the check out, so say honestly what this realistically buys), work needed for me (key generation tooling, payment integration), failure modes when the user is offline, and changes needed in backend/routes/settings.js and the Settings → License UI. Verify any third-party API or pricing claim against the vendor's current docs and cite the URL. Recommend one option. Do not write implementation code.
```

## Task 4: Test coverage for permissions

```
Add backend tests that cover authorization for the HTTP API. Use node:test (already set up, see backend/test/) plus supertest if needed (adding supertest as a devDependency is fine). Start the Express app against a temp SQLite file. If backend/index.js can't be imported without side effects (Docker connection, Discord login, schedulers), refactor minimally so the app can be created without starting those, e.g. export a createApp() factory, and keep production startup behavior identical.

Cover: unauthenticated requests get 401 on every /api route except login; a user with permissions on server A gets 403 on server B for files, console, config, backups, and tasks; an admin-only route is rejected for a non-admin. Don't mock the permission middleware; test the real one.
```

---

## Tips

- **Ask for a plan first on anything bigger than one file.** Add "Propose a plan and wait for my approval before editing" to the prompt.
- **Check claims of "tested" or "verified".** Codex can't reach forge. Anything that touches Docker, steamcmd, playit, or real game binaries still needs a live test on forge after merging.
- **Review diffs for scope creep.** Reject PRs that reformat files, bump dependencies, or "clean up" code the task didn't mention.
- **Keep AGENTS.md current.** When a task changes an architecture fact, the PR should update AGENTS.md too.
