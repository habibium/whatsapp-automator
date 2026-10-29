-- An authenticator app's key, sealed by `crypto::Cipher`. The row is a pending setup while
-- `enabled_at` is NULL: a first code from the app has to show it holds the key.
CREATE TABLE totp_secrets (
	user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
	secret BYTEA NOT NULL,
	enabled_at TIMESTAMPTZ,
	-- Time step of the last code accepted; a code from that step or an earlier one is a replay
	last_used_step BIGINT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recovery_codes (
	user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	code_hash BYTEA NOT NULL,
	used_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, code_hash)
);

-- A sign-in whose password checked out and that waits for a second factor
CREATE TABLE two_factor_challenges (
	token_hash BYTEA PRIMARY KEY,
	user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	attempts SMALLINT NOT NULL DEFAULT 0,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX two_factor_challenges_user_id_idx ON two_factor_challenges (user_id);
