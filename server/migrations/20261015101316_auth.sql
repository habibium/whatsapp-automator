CREATE TABLE sessions (
	token_hash BYTEA PRIMARY KEY,
	user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE TABLE user_tokens (
	token_hash BYTEA PRIMARY KEY,
	user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX user_tokens_user_id_purpose_idx ON user_tokens (user_id, purpose);

-- Hash of a cookie held by the browser that signed up, until the address is verified; a
-- verification link signs in that browser and no other
ALTER TABLE users ADD COLUMN signup_binding_hash BYTEA;
