package backend

import (
	"context"
	"crypto/rand"
	"time"

	"github.com/oraclepxx/passwd/backend/models"
	"github.com/oraclepxx/passwd/backend/vault"
)

// App is the main application struct. All exported methods are bound to the
// frontend via the Wails JS bridge.
type App struct {
	ctx     context.Context
	db      *vault.DB
	session *vault.VaultSession
}

// NewApp creates a new App instance.
func NewApp() *App {
	return &App{
		session: &vault.VaultSession{},
	}
}

// GetContext returns the app context (used by main.go for runtime calls).
func (a *App) GetContext() context.Context {
	return a.ctx
}

// Startup is called by Wails when the app starts.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	db, err := vault.Open()
	if err != nil {
		// DB failure is fatal — log and let the UI show an error state.
		println("ERROR: failed to open vault DB:", err.Error())
		return
	}
	a.db = db

	// Purge trash older than 30 days on every startup.
	_ = vault.PurgeExpiredTrash(db)
}

// Shutdown is called by Wails when the app is closing.
func (a *App) Shutdown(ctx context.Context) {
	a.session.Lock()
	if a.db != nil {
		a.db.Close()
	}
}

// ── Vault ────────────────────────────────────────────────────────────────────

// VaultExists reports whether a vault has been created.
func (a *App) VaultExists() bool {
	if a.db == nil {
		return false
	}
	exists, _ := vault.VaultExists(a.db)
	return exists
}

// VaultCreate initialises a new vault with the given master password.
// Returns an error if a vault already exists.
func (a *App) VaultCreate(password string) error {
	if a.db == nil {
		return models.ErrVaultNotFound
	}

	exists, err := vault.VaultExists(a.db)
	if err != nil {
		return err
	}
	if exists {
		return models.ErrVaultAlreadyExists
	}

	salt := make([]byte, 32)
	if _, err := rand.Read(salt); err != nil {
		return err
	}

	key, err := vault.DeriveKey([]byte(password), salt)
	if err != nil {
		return err
	}

	// Encrypt a known constant so we can verify the password on future unlocks.
	verifier, verifierNonce, err := vault.Encrypt(key, []byte("passwd-verifier"))
	if err != nil {
		return err
	}

	if err := vault.SaveVaultMeta(a.db, salt, verifier, verifierNonce); err != nil {
		return err
	}

	pw := []byte(password)
	clear(pw)

	a.session.Unlock(key)
	return nil
}

// VaultUnlock derives the vault key from the master password and unlocks the session.
func (a *App) VaultUnlock(password string) error {
	if a.db == nil {
		return models.ErrVaultNotFound
	}

	salt, verifier, verifierNonce, err := vault.LoadVaultMeta(a.db)
	if err != nil {
		return models.ErrVaultNotFound
	}

	key, err := vault.DeriveKey([]byte(password), salt)
	if err != nil {
		return err
	}
	pw := []byte(password)
	clear(pw)

	// Verify the derived key is correct before unlocking (skip for legacy vaults without a verifier).
	if len(verifier) > 0 {
		plaintext, decErr := vault.Decrypt(key, verifier, verifierNonce)
		if decErr != nil || string(plaintext) != "passwd-verifier" {
			clear(key[:])
			return models.ErrWrongPassword
		}
	}

	a.session.Unlock(key)
	return nil
}

// VaultChangeMasterPassword re-derives and updates the vault key using a new master password.
// The current password is verified before the change is applied.
func (a *App) VaultChangeMasterPassword(currentPassword, newPassword string) error {
	if a.db == nil {
		return models.ErrVaultNotFound
	}
	if !a.session.IsUnlocked() {
		return models.ErrVaultLocked
	}

	// Verify current password.
	salt, verifier, verifierNonce, err := vault.LoadVaultMeta(a.db)
	if err != nil {
		return models.ErrVaultNotFound
	}
	currentKey, err := vault.DeriveKey([]byte(currentPassword), salt)
	if err != nil {
		return err
	}
	cp := []byte(currentPassword)
	clear(cp)
	if len(verifier) > 0 {
		plaintext, decErr := vault.Decrypt(currentKey, verifier, verifierNonce)
		if decErr != nil || string(plaintext) != "passwd-verifier" {
			clear(currentKey[:])
			return models.ErrWrongPassword
		}
	}
	clear(currentKey[:])

	// Derive new key with a fresh salt.
	newSalt := make([]byte, 32)
	if _, err := rand.Read(newSalt); err != nil {
		return err
	}
	newKey, err := vault.DeriveKey([]byte(newPassword), newSalt)
	if err != nil {
		return err
	}
	np := []byte(newPassword)
	clear(np)

	newVerifier, newVerifierNonce, err := vault.Encrypt(newKey, []byte("passwd-verifier"))
	if err != nil {
		clear(newKey[:])
		return err
	}
	if err := vault.UpdateVaultMeta(a.db, newSalt, newVerifier, newVerifierNonce); err != nil {
		clear(newKey[:])
		return err
	}

	a.session.Unlock(newKey)
	return nil
}

// VaultLock locks the vault and zeroes the key from memory.
func (a *App) VaultLock() error {
	a.session.Lock()
	return nil
}

// VaultIsUnlocked reports whether the vault is currently unlocked.
func (a *App) VaultIsUnlocked() bool {
	return a.session.IsUnlocked()
}

// ── Records ──────────────────────────────────────────────────────────────────

// RecordCreate encrypts and stores a new password record.
func (a *App) RecordCreate(input models.RecordInput) (string, error) {
	key, err := a.session.Key()
	if err != nil {
		return "", err
	}
	return vault.CreateRecord(a.db, key, input)
}

// RecordList returns summaries of active records, optionally filtered by query.
func (a *App) RecordList(query string) ([]models.RecordSummary, error) {
	if !a.session.IsUnlocked() {
		return nil, models.ErrVaultLocked
	}
	return vault.ListRecords(a.db, query)
}

// RecordListTrash returns summaries of soft-deleted (trash) records.
func (a *App) RecordListTrash() ([]models.RecordSummary, error) {
	if !a.session.IsUnlocked() {
		return nil, models.ErrVaultLocked
	}
	return vault.ListDeletedRecords(a.db)
}

// RecordGet decrypts and returns the full detail of a single record.
func (a *App) RecordGet(id string) (models.RecordDetail, error) {
	key, err := a.session.Key()
	if err != nil {
		return models.RecordDetail{}, err
	}
	return vault.GetRecord(a.db, key, id)
}

// RecordUpdate re-encrypts a record with new data.
func (a *App) RecordUpdate(id string, data models.RecordInput) error {
	key, err := a.session.Key()
	if err != nil {
		return err
	}
	return vault.UpdateRecord(a.db, key, id, data)
}

// RecordDelete soft-deletes a record.
func (a *App) RecordDelete(id string) error {
	if !a.session.IsUnlocked() {
		return models.ErrVaultLocked
	}
	return vault.DeleteRecord(a.db, id)
}

// RecordRestore restores a soft-deleted record.
func (a *App) RecordRestore(id string) error {
	if !a.session.IsUnlocked() {
		return models.ErrVaultLocked
	}
	return vault.RestoreRecord(a.db, id)
}

// RecordPurge permanently deletes a soft-deleted record.
func (a *App) RecordPurge(id string) error {
	if !a.session.IsUnlocked() {
		return models.ErrVaultLocked
	}
	return vault.PurgeRecord(a.db, id)
}

// RecordHistory returns the last 5 decrypted secret field history entries.
func (a *App) RecordHistory(id string) ([]models.SecretHistory, error) {
	key, err := a.session.Key()
	if err != nil {
		return nil, err
	}
	return vault.GetHistory(a.db, key, id)
}

// ── Utilities ────────────────────────────────────────────────────────────────

// PasswordGenerate produces a random password per the given options.
func (a *App) PasswordGenerate(opts models.GeneratorOptions) (string, error) {
	return vault.Generate(opts)
}

// ClipboardCopy writes value to the OS clipboard and clears it after timeoutSecs.
func (a *App) ClipboardCopy(value string, timeoutSecs int) error {
	if err := vault.ClipboardWrite(value); err != nil {
		return err
	}
	go func() {
		timer := time.NewTimer(time.Duration(timeoutSecs) * time.Second)
		defer timer.Stop()
		<-timer.C
		_ = vault.ClipboardWrite("")
	}()
	return nil
}
