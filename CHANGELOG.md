# Changelog

## [0.1.0-alpha.6] - 2026-10-31

### Features

- **server:** Add password re-check and security alert emails (339c56f)
- **web:** Add security settings page and password confirmation dialog (905fea3)
- **server:** Rate-limit auth writes per client IP (a85167e)
- **server:** Key the IP rate limit on CLIENT_IP_HEADER when set (1eb84d7)
- **server:** Sweep refilled keys out of the IP rate limiter (d810fbc)
- **server:** Limit sign-in attempts per account (9037a1d)
- **server:** Limit password re-checks per user (781e9c6)
- **server:** Reject breached passwords at sign-up (0c18679)
- **server:** Reject breached passwords on reset (c6eeb3e)
- **web:** Add a helper that reads Retry-After (bbef4d5)
- **web:** Say when sign-in is rate-limited (cc7af11)
- **web:** Say when sign-up is rate-limited (320f47f)
- **web:** Say when an emailed-link request is rate-limited (abb2cc2)
- **web:** Say when a password reset is rate-limited (957c97e)
- **web:** Say when resending the verification link is rate-limited (05f7c9c)
- **web:** Say when email verification is rate-limited (0f6a4cd)
- **web:** Say when a password re-check is rate-limited (9968f07)
- **server:** Add passkey and passkey ceremony tables (1eeaf15)
- **server:** Add passkey registration (2828769)
- **server:** List and remove passkeys (aec5902)
- **server:** Sign in with a passkey (35c2cfa)
- **web:** Add passkey WebAuthn helpers (569047b)
- **web:** Sign in with a passkey (c4ff145)
- **web:** Manage passkeys in security settings (9bcbcfd)
- **server:** Add an AEAD cipher for secrets at rest (26695a1)
- **server:** Read ENCRYPTION_KEY into the app state (226ee15)
- **server:** Add tables for two-step verification (7af34b7)
- **server:** Start two-step verification setup (3caecc5)
- **server:** Turn two-step verification on with a first code (a3ac03c)
- **server:** Turn two-step verification off (ed734f6)
- **server:** Replace recovery codes on request (58079b7)
- **server:** Finish a sign-in with a second factor (c8715d3)
- **server:** End pending second-factor sign-ins on password reset (a617dcb)
- **server:** End pending second-factor sign-ins when it is turned off (71327b4)
- **server:** Sweep expired second-factor challenges hourly (f60294b)
- **web:** Add an authenticator code field (269eb0e)
- **web:** Add the second step of signing in (ced3c3e)
- Ask for the second factor at sign-in (bf0ef72)
- **web:** Show new recovery codes once, with copy and download (73e9d2c)
- **web:** Add the authenticator app setup dialog (7eb7f2e)
- **web:** Add the two-step verification settings section (c8f1185)
- **web:** Put two-step verification on the security page (b701e81)
- **web:** Say when a code or passkey sign-in is rate-limited (1e75cde)

### Bug Fixes

- **server:** Limit second-factor codes per account across sign-ins (69efbcd)
- **server:** Email the owner when a sign-in runs out of codes (b0b4e48)
- **server:** Expire pending two-step setups after 15 minutes (b7d2b00)
- **server:** Sweep expired two-step setups hourly (689809a)
- **server:** Delete a pending two-step setup after five wrong codes (30b2d1e)
- **server:** Count enable codes toward the per-account code limit (67c1dad)
- **server:** Take the account lock while saving a pending two-step key (ba8a1cd)
- **server:** Turn on only the key the confirming code was checked against (eaa83cb)
- **server:** Give each security alert a remedy that works for it (7cbb58e)
- **server:** Link the new-passkey alert to the security settings (564b2ff)
- **server:** Email the owner after a recovery-code sign-in (1ef56d7)
- **web:** Say when turning on two-step verification is rate-limited (24b2fc4)
- **web:** Explain an ended two-step setup and offer to start again (f6bc3d5)
- **server:** Cap wrong second-factor codes per account, not every code (1982ac1)

### Documentation

- **server:** Document the 429 on auth writes in OpenAPI (a51c73f)
- Document rate limits, CLIENT_IP_HEADER and the breached-password check (78593f5)
- Document passkeys (1b8e3bf)
- Document ENCRYPTION_KEY (1e24d2d)
- Document two-step verification (0dfbf12)
- Document the second-factor code limits and alerts (e435b88)
- Describe the daily cap on wrong second-factor codes (c46502a)

### Maintenance

- **server:** Cover the per-IP limit on auth writes (3d72728)
- **server:** Cover the per-account sign-in limit (353c307)
- **server:** Cover breached passwords at sign-up and reset (5aa7d90)
- **server:** Drive passkey ceremonies with a software authenticator (bb24f0e)
- **server:** Cover two-step verification end to end (49ab4c5)
- **web:** Drop a doc comment that restates the component name (06d4dff)
- **server:** Keep sent emails for tests to read (676f2e2)
- **server:** Limit second-factor codes per account across sign-ins (37c7995)
- **server:** Alert the owner once when a sign-in runs out of codes (45a5a8a)
- **server:** Expire a pending two-step setup after 15 minutes (53b145b)
- **server:** End a pending two-step setup after five wrong codes (ce403a8)
- **server:** Refuse to turn on a key that replaced the checked one (980c2e2)
- **server:** Render every security alert with its own remedy (f8bba87)
- **server:** Email the owner after a recovery-code sign-in only (c8486d6)
- **server:** Cap only wrong second-factor codes (fd74f46)

### Other

- Merge passkeys into rewrite

Passkey re-checks go through the rate-limited confirm_password, which
now takes the app state. (1ede79b)
- Merge two-step verification into rewrite

Sign-in keeps the per-account rate limit ahead of the lookup and now
answers with the two-factor union. Settings show two-step verification
above passkeys, and the session-holding test helper lives on TestApp. (af922f7)
## [0.1.0-alpha.5] - 2026-10-29

### Features

- Expose application version in Vite config and update footer to display version (d66fb25)
- **server:** Add email verification, sign-in and password reset (7d6f0aa)
- **web:** Add sign-in, email verification and password reset pages (ca20bf3)

### Documentation

- Document auth configuration and account behaviour (0aaf152)

### Maintenance

- Run server tests against Postgres (f0c7584)
## [0.1.0-alpha.4] - 2026-09-28

### Features

- Add version field to health check response and OpenAPI schema (2fc0eee)

### Refactoring

- Remove unused import (95d1afa)

### Other

- Remove eyebrows (52cb63a)
## [0.1.0-alpha.3] - 2026-09-16

### Maintenance

- Move version and edition to workspace root (5e13337)
- Add compression and caching headers for web assets (4185851)
## [0.1.0-alpha.2] - 2026-09-16

### Features

- **web:** Add site frame, section index and wordmark for the new design (9a4691f)
- **web:** Redesign the marketing homepage (771e98d)
- **web:** Add password field with inline reveal and attached status (6810eb5)
- **web:** Redesign the auth layout and signup form (552499b)
- **web:** Set trigger mode to fixed for TanStack Devtools (e9b509b)
- Implement 404 (ab362e2)
## [0.1.0-alpha.1] - 2026-09-14

### Features

- Implement authentication routes and UI components for sign-in and sign-up, including form validation and user feedback (8fdac2a)
- Setup vite proxy (e1012a2)
- Integrate anyhow for error handling in main function and update dependencies (9e735c7)
- Add OpenAPI generation and update run command in bacon.toml (759e30e)
- Add OpenAPI types generation command and update dependencies in package.json (3317681)
- Integrate @tanstack/react-query and openapi-fetch for API handling (f1361e7)
- Setup db pool and AppState (4a3321a)
- Add AppError (c860255)
- Create auth module, and add signup handler (785800a)
- Enhance error handling with ErrorBody schema and validation details (6a040bf)
- Integrate argon2 for password hashing and add password module (a936c02)
- Add Internal error variant to AppError for better error handling (ae6f9d8)
- Implement user model and insert function for user registration (38bf499)
- Implement signup (c16b303)
- Add signup ui (147e2b6)
- Add health endpoint (a5cdccb)
- Create config module (23dd74f)
- Add CI workflow for Rust and Web projects (4981139)
- Add Dockerfile, release workflow, and changelog configuration (acc9453)
- Move the stylex and astryx (595382e)
- Imeplement theme toggle (3537579)
- Enhance release workflow for pre-releases and version validation (22e7ba3)

### Bug Fixes

- **lint:** Fix rust lints (417c17c)

### Refactoring

- Update Vite configuration and remove wrangler.jsonc (dfe442d)
- Remove unused import in main.rs (f06ae9b)
- Move the api routes to lib (a3cdf9c)
- Simplify validation and error handling in signup process (e2c7b4d)
- Rename AuthRequest and AuthResponse to Credentials and UserResponse (fe7181d)

### Documentation

- Add AGENTS.md for skill loading instructions and reference in CLAUDE.md (b9db80c)
- Update README.md for clarity and add new commands (543d68a)

### Maintenance

- Start fresh (2cd0e0c)
- Init (1968c10)
- Setup workspace for apps (aaef8ad)
- Init tanstack start web project (c1246d7)
- Setup turborepo (90db9de)
- Update web packages (cf872a6)
- Init shadcn (0793ac7)
- Use react swc (2ee62c5)
- Init hono app (c603113)
- Add better-auth package and update dependencies in pnpm-lock.yaml (8b106af)
- Add VSCode configuration files for extensions and editor settings (30a12f5)
- Format codebase (650fefa)
- Init rust workspace (30012bd)
- Update package manager version and clean up pnpm-lock.yaml by removing unused dependencies (86a7ccd)
- Add new dependencies including @tanstack/react-form, next-themes, sonner, and zod in package.json and pnpm-lock.yaml (13f5231)
- Scaffold project (a743d2c)
- Setup hello world server (289aefb)
- Update tracing filters (ea96d84)
- **docs:** Add utoipa boilerplate and basic scalar docs (2d45c82)
- **docs:** Utilize utoipa-axum (9742e1c)
- Simplify dev and preview scripts in package.json by removing port specification (04cfdd5)
- Update configuration files and improve type imports (48fd2f1)
- Add vite plugin, and scripts to auto generate API types (e8de581)
- Update gen api types script (cd19f5d)
- Add scroll anchor configuration to bacon.toml (a64772e)
- Install whatsapp-rust (85865ef)
- Add justfile and mprocs configuration (5626a57)
- Add db deps (008d231)
- Add example .env (16c714d)
- Update dependencies in Cargo.lock and Cargo.toml, removing unused packages (d545bc1)
- Install shadcn components, zod, and tanstack form (994596f)
- Serve static web content using tower (2da48a9)
- Update sqlx cache (8d40fb3)
- Update pnpm setup action to version 2 and adjust configuration (fe155e8)
- Update CHANGELOG.md (dd4195f)
- Format README (8c71052)
- Update Dockerfile, and justfile (6c99f12)

### Other

- Update .gitignore (0a769cf)
- Update package.json (10eb32f)
- Update pnpm-workspace.yaml (0f7342e)
- Update .gitignore (69b4718)

