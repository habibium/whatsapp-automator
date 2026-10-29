-- Wrong codes entered against a pending setup; enough of them delete it
ALTER TABLE totp_secrets ADD COLUMN setup_attempts SMALLINT NOT NULL DEFAULT 0;
