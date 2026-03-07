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

	return db, nil
}

// Close closes the database connection.
func (db *DB) Close() error {
	return db.conn.Close()
}

// migrate creates tables and indexes if they don't exist.
func (db *DB) migrate() error {
	_, err := db.conn.Exec(`
		CREATE TABLE IF NOT EXISTS vault_meta (
			id      INTEGER PRIMARY KEY CHECK (id = 1),
			salt    BLOB    NOT NULL,
			version INTEGER NOT NULL DEFAULT 1
		);

		CREATE TABLE IF NOT EXISTS records (
			id          TEXT    PRIMARY KEY,
			ciphertext  BLOB    NOT NULL,
			nonce       BLOB    NOT NULL,
			created_at  INTEGER NOT NULL,
			updated_at  INTEGER NOT NULL,
			deleted_at  INTEGER,
			search_hint TEXT    NOT NULL
		);

		CREATE TABLE IF NOT EXISTS password_history (
			id          TEXT    PRIMARY KEY,
			record_id   TEXT    NOT NULL REFERENCES records(id),
			ciphertext  BLOB    NOT NULL,
			nonce       BLOB    NOT NULL,
			replaced_at INTEGER NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_records_deleted_at ON records(deleted_at);
		CREATE INDEX IF NOT EXISTS idx_records_search     ON records(search_hint);
		CREATE INDEX IF NOT EXISTS idx_history_record     ON password_history(record_id);
	`)
	return err
}
