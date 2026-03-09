package vault

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// DB wraps a SQLite database connection.
type DB struct {
	conn *sql.DB
}

// Open opens (or creates) the SQLite database at the platform config dir.
func Open() (*DB, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, fmt.Errorf("get config dir: %w", err)
	}

	appDir := filepath.Join(configDir, "passwd")
	if err := os.MkdirAll(appDir, 0700); err != nil {
		return nil, fmt.Errorf("create app dir: %w", err)
	}

	dbPath := filepath.Join(appDir, "vault.db")
	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	conn.SetMaxOpenConns(1)

	db := &DB{conn: conn}
	if err := db.migrate(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	// Additive migration: add verifier columns to existing databases (errors ignored when already present).
	_, _ = db.conn.Exec(`ALTER TABLE vault_meta ADD COLUMN verifier BLOB`)
	_, _ = db.conn.Exec(`ALTER TABLE vault_meta ADD COLUMN verifier_nonce BLOB`)

	return db, nil
}

// Close closes the database connection.
func (db *DB) Close() error {
	return db.conn.Close()
}

// VaultExists reports whether vault_meta has been initialised.
func VaultExists(db *DB) (bool, error) {
	var count int
	err := db.conn.QueryRow(`SELECT COUNT(*) FROM vault_meta`).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// SaveVaultMeta stores the salt and verifier in vault_meta (insert once).
func SaveVaultMeta(db *DB, salt, verifier, verifierNonce []byte) error {
	_, err := db.conn.Exec(
		`INSERT INTO vault_meta (id, salt, verifier, verifier_nonce) VALUES (1, ?, ?, ?)`,
		salt, verifier, verifierNonce,
	)
	return err
}

// UpdateVaultMeta replaces the salt and verifier in vault_meta (used when changing the master password).
func UpdateVaultMeta(db *DB, salt, verifier, verifierNonce []byte) error {
	_, err := db.conn.Exec(
		`UPDATE vault_meta SET salt=?, verifier=?, verifier_nonce=? WHERE id=1`,
		salt, verifier, verifierNonce,
	)
	return err
}

// LoadVaultMeta reads the salt, verifier, and verifier_nonce from vault_meta.
func LoadVaultMeta(db *DB) (salt, verifier, verifierNonce []byte, err error) {
	err = db.conn.QueryRow(
		`SELECT salt, verifier, verifier_nonce FROM vault_meta WHERE id = 1`,
	).Scan(&salt, &verifier, &verifierNonce)
	return
}

// migrate creates tables and indexes if they don't exist.
func (db *DB) migrate() error {
	_, err := db.conn.Exec(`
		CREATE TABLE IF NOT EXISTS vault_meta (
			id             INTEGER PRIMARY KEY CHECK (id = 1),
			salt           BLOB    NOT NULL,
			version        INTEGER NOT NULL DEFAULT 1,
			verifier       BLOB,
			verifier_nonce BLOB
		);

		CREATE TABLE IF NOT EXISTS records (
			id          TEXT    PRIMARY KEY,
			record_type TEXT    NOT NULL DEFAULT 'password',
			ciphertext  BLOB    NOT NULL,
			nonce       BLOB    NOT NULL,
			created_at  INTEGER NOT NULL,
			updated_at  INTEGER NOT NULL,
			deleted_at  INTEGER,
			search_hint TEXT    NOT NULL
		);

		CREATE TABLE IF NOT EXISTS secret_history (
			id          TEXT    PRIMARY KEY,
			record_id   TEXT    NOT NULL REFERENCES records(id),
			ciphertext  BLOB    NOT NULL,
			nonce       BLOB    NOT NULL,
			replaced_at INTEGER NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_records_deleted_at ON records(deleted_at);
		CREATE INDEX IF NOT EXISTS idx_records_search     ON records(search_hint);
		CREATE INDEX IF NOT EXISTS idx_history_record     ON secret_history(record_id);
	`)
	if err != nil {
		return err
	}
	// Additive migrations for existing databases.
	_, _ = db.conn.Exec(`ALTER TABLE records ADD COLUMN record_type TEXT NOT NULL DEFAULT 'password'`)
	return nil
}
