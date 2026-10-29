CREATE TABLE passkeys (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	credential_id BYTEA NOT NULL UNIQUE,
	-- webauthn-rs `Passkey`: the public key plus the signature counter and backup state, which
	-- change as it is used
	passkey JSONB NOT NULL,
	name TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	last_used_at TIMESTAMPTZ
);

CREATE INDEX passkeys_user_id_idx ON passkeys (user_id);

-- A passkey registration or sign-in under way, keyed by the hash of a cookie the browser holds. The
-- challenge state stays here, so the browser cannot replay or alter it.
CREATE TABLE passkey_ceremonies (
	token_hash BYTEA PRIMARY KEY,
	-- Who is registering; a sign-in starts before anyone is known
	user_id UUID REFERENCES users (id) ON DELETE CASCADE,
	kind TEXT NOT NULL CHECK (kind IN ('registration', 'authentication')),
	state JSONB NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	CHECK ((kind = 'registration') = (user_id IS NOT NULL))
);
