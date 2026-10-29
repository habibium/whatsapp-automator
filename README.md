# whatsapp-automator

Schedule and send WhatsApp messages. Rust backend (`server/`, axum) and a React frontend (`web/`, Vite + TanStack), shipped as one Docker image.

Run it yourself with the image described under [Self-hosting](#self-hosting), or use the hosted service.

## Hosted service

The maintainer runs a hosted instance at https://wa.habibium.com. It runs the same image that is published from this repository.

## Prerequisites

- Rust nightly (`rustup toolchain install nightly`), plus `cargo install bacon just mprocs git-cliff`
- Node 24+ and `pnpm`
- OpenSSL headers and `pkg-config` (`libssl-dev` on Debian), which the passkey library links against

## Development

```sh
just dev
```

Starts both processes in one terminal via [mprocs](https://github.com/pvolok/mprocs):

| Process  | Command    | URL                                         |
| -------- | ---------- | ------------------------------------------- |
| `server` | `bacon`    | http://localhost:8000 (docs at `/api/docs`) |
| `web`    | `pnpm dev` | http://localhost:5173                       |

mprocs keys: `Ctrl+a` toggles focus between the process list and the terminal, `j`/`k` select a process, `r` restarts it, `q` quits everything. With the terminal focused, keys go to the process, so bacon's shortcuts (`c` clippy, `/` search) still work.

You can also run the two halves in separate panes: `bacon` at the root and `pnpm dev` inside `web/`.

## Typesafe API contract

The backend is the source of truth. utoipa derives an OpenAPI spec from the axum routes; the frontend generates TypeScript types from it.

```
server/src/lib.rs  ──cargo run --bin openapi──▶  openapi.json  ──openapi-typescript──▶  web/src/api/schema.d.ts
```

Both steps run automatically in `just dev`: bacon regenerates `openapi.json` before every server restart, and a Vite plugin watches that file and regenerates `schema.d.ts`. Both generated files are committed, and `just check` fails if either is out of date.

To run the generation by hand: `just gen-api`.

## Commands

| Recipe              | What it does                                                           |
| ------------------- | ---------------------------------------------------------------------- |
| `just dev`          | Start backend and frontend                                             |
| `just check`        | Clippy, tests, OpenAPI freshness, formatting, lint, TS types freshness |
| `just fmt`          | Format Rust and TypeScript                                             |
| `just gen-api`      | Regenerate `openapi.json` and `schema.d.ts`                            |
| `just build`        | Production build: `web/dist` and the release binary                    |
| `just start`        | Run the release binary, serving the SPA and the API on one port        |
| `just docker-build` | Build the production image locally                                     |
| `just changelog`    | Preview the changelog entries since the last release                   |
| `just release`      | Tag a version and push; CI builds, publishes and deploys it            |

Run `just` alone to list recipes.

## Configuration

Environment variables, or a `.env` file in development (see `.env.example`):

| Variable           | Default                                                             | Purpose                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`     | required                                                            | Postgres connection string                                                                                                                                                                |
| `PORT`             | `8000`                                                              | Listen port                                                                                                                                                                               |
| `WEB_DIR`          | `web/dist`                                                          | Built SPA to serve for non-`/api` paths                                                                                                                                                   |
| `RUST_LOG`         | `info,server=debug,…`                                               | tracing filter                                                                                                                                                                            |
| `APP_URL`          | required in release builds; `http://localhost:5173` in debug builds | Public URL of the app. Links in emails point here, and an `https` URL makes the cookies `Secure`                                                                                          |
| `SMTP_URL`         | required when `APP_URL` is `https`                                  | SMTP server for verification and password reset emails, e.g. `smtps://user:password@host:465`                                                                                             |
| `EMAIL_FROM`       | required with SMTP                                                  | Sender, e.g. `WhatsApp Automator <no-reply@example.com>`                                                                                                                                  |
| `ENCRYPTION_KEY`   | required in release builds; a fixed development key in debug builds | Encrypts secrets kept in the database, such as authenticator app keys: 32 random bytes in base64, from `openssl rand -base64 32`                                                          |
| `CLIENT_IP_HEADER` | unset                                                               | Header a trusted proxy sets to the client's address, e.g. `CF-Connecting-IP` behind Cloudflare. Unset, rate limits key on the peer address. `X-Forwarded-For` and `Forwarded` are refused |

Migrations in `server/migrations` are embedded in the binary and applied at startup.

Without `SMTP_URL` the server writes each email, link included, to its log, which is enough for development and refused for an `https` `APP_URL`, since anyone who can read the log could use the links. Percent-encode special characters in the SMTP password (`@` becomes `%40`). `smtps://` connects on port 465 with TLS from the start; for port 587 use `smtp://user:password@host:587?tls=required`.

Keep `ENCRYPTION_KEY` apart from the database and its backups: together they reveal every secret it protects. Replacing or losing it stops every authenticator app set up so far from working, and those users have to sign in with a recovery code and set two-step verification up again.

## Accounts

Sign-up takes an email address and a password. The account cannot sign in until the address is verified through the emailed link, which works for 24 hours. Opened in the browser that signed up, the link also signs the user in; anywhere else it only verifies the address, so a link opened in someone else's browser cannot sign them into the wrong account. Password reset links work once, for an hour, and end every session and outstanding link of the account. Sessions last 30 days and extend while in use; the browser holds them in an `HttpOnly` cookie, and the database stores only a SHA-256 hash of each session and link token.

Writes under `/api/auth` are rate-limited per client address: a burst of 20, then one every 6 seconds, with IPv6 addresses counted per /64. Sign-in attempts are also limited per account and password re-checks per user, however many addresses they come from: 10, then one every 90 seconds. Second-factor codes, whether at sign-in or while turning two-step verification on, are limited per account to 5, then one every 30 minutes, however many sign-ins they are spread over. A refused request gets a 429 with `Retry-After`. The limits live in memory, so they are per instance and reset on restart. Behind a proxy, set `CLIENT_IP_HEADER`, or every client shares the proxy's address; the server trusts that header as sent, so it must only be reachable through the proxy.

Sign-up and password reset refuse passwords listed in Have I Been Pwned's [Pwned Passwords](https://haveibeenpwned.com/API/v3#PwnedPasswords). Only the first 5 characters of the password's SHA-1 hash leave the server. When the service does not answer within 3 seconds, the password is accepted and a warning logged.

Two-step verification is optional and works with any authenticator app (TOTP: SHA-1, 6 digits, 30-second steps, one step of clock drift allowed). Turning it on, turning it off and replacing the recovery codes ask for the password again and email the owner, and turning it on also ends every other session. A new key waits 15 minutes for the first code from the app, and five wrong codes end that setup. With it on, the password starts a sign-in that waits five minutes for a code from the app or one of ten single-use recovery codes, and each app code works once. Five wrong codes end the sign-in and email the owner, since whoever tried had the password; that email goes out at most once every 6 hours per account. Starting over from the password does not buy more guesses: an account takes 30 wrong codes a day across all its sign-ins, and only a right code or a password reset clears the count. A sign-in with a recovery code emails the owner too, with how many codes are left. A password reset ends a sign-in that is waiting for its code but leaves two-step verification on. The app's key is encrypted with `ENCRYPTION_KEY` (XChaCha20-Poly1305, with the user's id bound in), and recovery codes and waiting sign-ins are stored only as SHA-256 hashes.

Passkeys are added under Security settings, after the password is entered again, and sign in without an email address or password: from the "Sign in with a passkey" button, or from the browser's autofill on the email field. A passkey always verifies its user with a PIN or biometrics, so a passkey sign-in needs no other step. Each passkey is bound to the host of `APP_URL`, its relying party ID, so moving the app to another host leaves existing passkeys unusable. Removing one asks for the password too, and either change emails the owner. A registration or sign-in challenge stays on the server for five minutes, named by an `HttpOnly` cookie, and works once.
