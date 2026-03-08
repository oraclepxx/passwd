package vault

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"
)

func TestOpen_CreatesTablesAndIndexes(t *testing.T) {
	// Use a temp dir instead of the real config dir.
	tmp := t.TempDir()
	dbPath := filepath.Join(tmp, "vault.db")

	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer conn.Close()

	db := &DB{conn: conn}
	if err := db.migrate(); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	tables := []string{"vault_meta", "records", "secret_history"}
	for _, table := range tables {
		var name string
		err := conn.QueryRow(
			`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, table,
		).Scan(&name)
		if err != nil {
			t.Errorf("table %q not found: %v", table, err)
		}
	}

	indexes := []string{"idx_records_deleted_at", "idx_records_search", "idx_history_record"}
	for _, idx := range indexes {
		var name string
		err := conn.QueryRow(
			`SELECT name FROM sqlite_master WHERE type='index' AND name=?`, idx,
		).Scan(&name)
		if err != nil {
			t.Errorf("index %q not found: %v", idx, err)
		}
	}
}

func TestOpen_UsesConfigDir(t *testing.T) {
	// Override config dir via env (XDG_CONFIG_HOME on macOS falls back to HOME).
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)
	// On macOS UserConfigDir returns $HOME/Library/Application Support
	if err := os.MkdirAll(filepath.Join(tmp, "Library", "Application Support"), 0700); err != nil {
		t.Fatal(err)
	}

	db, err := Open()
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()
}
