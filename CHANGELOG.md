# Changelog

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

