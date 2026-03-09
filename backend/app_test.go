package backend

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/oraclepxx/passwd/backend/models"
)

// newTestApp creates an App with a temporary database directory.
// Argon2id is slow (by design); these are integration tests — expect ~1-2s per vault op.
func newTestApp(t *testing.T) *App {
	t.Helper()
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)
	// macOS UserConfigDir → $HOME/Library/Application Support
	if err := os.MkdirAll(filepath.Join(tmp, "Library", "Application Support"), 0700); err != nil {
		t.Fatal(err)
	}
	app := NewApp()
	app.Startup(context.Background())
	t.Cleanup(func() {
		if app.db != nil {
			app.db.Close()
		}
	})
	return app
}

// TestApp_VaultCreate_SetsUnlocked verifies that creating a vault immediately unlocks the session.
func TestApp_VaultCreate_SetsUnlocked(t *testing.T) {
	app := newTestApp(t)

	if app.VaultIsUnlocked() {
		t.Error("expected vault to be locked before creation")
	}

	if err := app.VaultCreate("correct-horse-battery"); err != nil {
		t.Fatalf("VaultCreate: %v", err)
	}

	if !app.VaultIsUnlocked() {
		t.Error("expected vault to be unlocked after creation")
	}
}

// TestApp_VaultCreate_Duplicate returns ErrVaultAlreadyExists on second call.
func TestApp_VaultCreate_DuplicateFails(t *testing.T) {
	app := newTestApp(t)

	if err := app.VaultCreate("password1"); err != nil {
		t.Fatalf("first VaultCreate: %v", err)
	}
	if err := app.VaultCreate("password2"); err != models.ErrVaultAlreadyExists {
		t.Errorf("expected ErrVaultAlreadyExists, got %v", err)
	}
}

// TestApp_VaultUnlock_WrongPassword returns ErrWrongPassword.
func TestApp_VaultUnlock_WrongPassword(t *testing.T) {
	app := newTestApp(t)
	if err := app.VaultCreate("correct-pass"); err != nil {
		t.Fatalf("VaultCreate: %v", err)
	}
	app.VaultLock()

	if err := app.VaultUnlock("wrong-pass"); err != models.ErrWrongPassword {
		t.Errorf("expected ErrWrongPassword, got %v", err)
	}
	if app.VaultIsUnlocked() {
		t.Error("expected vault to remain locked after wrong password")
	}
}

// TestApp_VaultUnlock_CorrectPassword unlocks the session.
func TestApp_VaultUnlock_CorrectPassword(t *testing.T) {
	app := newTestApp(t)
	const pw = "my-vault-password"
	if err := app.VaultCreate(pw); err != nil {
		t.Fatalf("VaultCreate: %v", err)
	}
	app.VaultLock()

	if err := app.VaultUnlock(pw); err != nil {
		t.Fatalf("VaultUnlock: %v", err)
	}
	if !app.VaultIsUnlocked() {
		t.Error("expected vault to be unlocked")
	}
}

// TestApp_LockedVault_RejectsRecordOperations verifies all record methods return ErrVaultLocked.
func TestApp_LockedVault_RejectsRecordOperations(t *testing.T) {
	app := newTestApp(t)
	// Vault is not created — session is locked.

	if _, err := app.RecordCreate(models.RecordInput{Type: "password", Name: "x", Username: "u", Password: "p"}); err != models.ErrVaultLocked {
		t.Errorf("RecordCreate: expected ErrVaultLocked, got %v", err)
	}
	if _, err := app.RecordList(""); err != models.ErrVaultLocked {
		t.Errorf("RecordList: expected ErrVaultLocked, got %v", err)
	}
	if _, err := app.RecordGet("id"); err != models.ErrVaultLocked {
		t.Errorf("RecordGet: expected ErrVaultLocked, got %v", err)
	}
	if err := app.RecordUpdate("id", models.RecordInput{Type: "password"}); err != models.ErrVaultLocked {
		t.Errorf("RecordUpdate: expected ErrVaultLocked, got %v", err)
	}
	if err := app.RecordDelete("id"); err != models.ErrVaultLocked {
		t.Errorf("RecordDelete: expected ErrVaultLocked, got %v", err)
	}
	if err := app.RecordRestore("id"); err != models.ErrVaultLocked {
		t.Errorf("RecordRestore: expected ErrVaultLocked, got %v", err)
	}
	if err := app.RecordPurge("id"); err != models.ErrVaultLocked {
		t.Errorf("RecordPurge: expected ErrVaultLocked, got %v", err)
	}
	if _, err := app.RecordHistory("id"); err != models.ErrVaultLocked {
		t.Errorf("RecordHistory: expected ErrVaultLocked, got %v", err)
	}
}

// TestApp_RecordCRUD_Integration tests the full create → get → update → delete → restore → purge flow.
func TestApp_RecordCRUD_Integration(t *testing.T) {
	app := newTestApp(t)
	if err := app.VaultCreate("integration-pass"); err != nil {
		t.Fatalf("VaultCreate: %v", err)
	}

	// Create.
	id, err := app.RecordCreate(models.RecordInput{
		Type:     "password",
		Name:     "Integration Site",
		Username: "user@test.com",
		Password: "initial-pass",
		URL:      "https://example.com",
		Notes:    "integration test record",
	})
	if err != nil {
		t.Fatalf("RecordCreate: %v", err)
	}

	// List — record should appear.
	list, err := app.RecordList("")
	if err != nil {
		t.Fatalf("RecordList: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 record, got %d", len(list))
	}

	// Get — decrypted fields match.
	detail, err := app.RecordGet(id)
	if err != nil {
		t.Fatalf("RecordGet: %v", err)
	}
	if detail.Name != "Integration Site" {
		t.Errorf("name: got %q", detail.Name)
	}
	if detail.Password != "initial-pass" {
		t.Errorf("password: got %q", detail.Password)
	}

	// Update.
	if err := app.RecordUpdate(id, models.RecordInput{
		Type:     "password",
		Name:     "Integration Site",
		Username: "user@test.com",
		Password: "updated-pass",
	}); err != nil {
		t.Fatalf("RecordUpdate: %v", err)
	}
	detail, _ = app.RecordGet(id)
	if detail.Password != "updated-pass" {
		t.Errorf("updated password: got %q", detail.Password)
	}

	// History — old password preserved.
	history, err := app.RecordHistory(id)
	if err != nil {
		t.Fatalf("RecordHistory: %v", err)
	}
	if len(history) != 1 || history[0].Secret != "initial-pass" {
		t.Errorf("history: expected 1 entry with 'initial-pass', got %+v", history)
	}

	// Delete (soft).
	if err := app.RecordDelete(id); err != nil {
		t.Fatalf("RecordDelete: %v", err)
	}
	list, _ = app.RecordList("")
	if len(list) != 0 {
		t.Errorf("expected 0 active records after delete, got %d", len(list))
	}

	// Restore.
	if err := app.RecordRestore(id); err != nil {
		t.Fatalf("RecordRestore: %v", err)
	}
	list, _ = app.RecordList("")
	if len(list) != 1 {
		t.Errorf("expected 1 active record after restore, got %d", len(list))
	}

	// Purge (requires deleted state).
	app.RecordDelete(id)
	if err := app.RecordPurge(id); err != nil {
		t.Fatalf("RecordPurge: %v", err)
	}
	list, _ = app.RecordList("")
	if len(list) != 0 {
		t.Errorf("expected 0 records after purge, got %d", len(list))
	}
}

// TestApp_VaultChangeMasterPassword verifies new password works and old does not.
func TestApp_VaultChangeMasterPassword(t *testing.T) {
	app := newTestApp(t)
	const oldPw, newPw = "old-master-password", "new-master-password"

	if err := app.VaultCreate(oldPw); err != nil {
		t.Fatalf("VaultCreate: %v", err)
	}

	if err := app.VaultChangeMasterPassword(oldPw, newPw); err != nil {
		t.Fatalf("VaultChangeMasterPassword: %v", err)
	}

	// Lock and verify new password works.
	app.VaultLock()
	if err := app.VaultUnlock(newPw); err != nil {
		t.Fatalf("unlock with new password: %v", err)
	}

	// Old password must not work.
	app.VaultLock()
	if err := app.VaultUnlock(oldPw); err != models.ErrWrongPassword {
		t.Errorf("expected ErrWrongPassword with old password, got %v", err)
	}
}

// TestApp_VaultChangeMasterPassword_WrongCurrentFails rejects a bad current password.
func TestApp_VaultChangeMasterPassword_WrongCurrentFails(t *testing.T) {
	app := newTestApp(t)
	if err := app.VaultCreate("correct-pass"); err != nil {
		t.Fatalf("VaultCreate: %v", err)
	}

	if err := app.VaultChangeMasterPassword("wrong-current", "new-pass"); err != models.ErrWrongPassword {
		t.Errorf("expected ErrWrongPassword, got %v", err)
	}

	// Session should still be unlocked (change failed).
	if !app.VaultIsUnlocked() {
		t.Error("expected vault to remain unlocked after failed change")
	}
}

// TestApp_PasswordGenerate_Basic verifies PasswordGenerate produces correct-length output.
func TestApp_PasswordGenerate_Basic(t *testing.T) {
	app := newTestApp(t)
	pw, err := app.PasswordGenerate(models.GeneratorOptions{
		Length:       24,
		UseUppercase: true,
		UseNumbers:   true,
		UseSymbols:   true,
	})
	if err != nil {
		t.Fatalf("PasswordGenerate: %v", err)
	}
	if len(pw) != 24 {
		t.Errorf("expected length 24, got %d", len(pw))
	}
}
