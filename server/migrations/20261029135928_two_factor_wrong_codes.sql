-- Wrong sign-in codes since `wrong_codes_since`, across every challenge, so starting over from the
-- password does not buy more guesses
ALTER TABLE totp_secrets
	ADD COLUMN wrong_codes SMALLINT NOT NULL DEFAULT 0,
	ADD COLUMN wrong_codes_since TIMESTAMPTZ;
