package vault

import (
	"bytes"
	"testing"
)

func TestVaultExists_FalseOnNewDB(t *testing.T) {
	db := newTestDB(t)
	exists, err := VaultExists(db)
	if err != nil {
		t.Fatalf("VaultExists: %v", err)
	}
	if exists {
		t.Error("expected VaultExists to return false on a new empty database")
	}
}

func TestSaveLoadVaultMeta_RoundTrip(t *testing.T) {
	db := newTestDB(t)

	salt := []byte("saltsaltsaltsaltsaltsaltsaltsalt") // 32 bytes
	verifier := []byte("verifierbytes")
	verifierNonce := []byte("nonce-12bytes")

	if err := SaveVaultMeta(db, salt, verifier, verifierNonce); err != nil {
		t.Fatalf("SaveVaultMeta: %v", err)
	}

	gotSalt, gotVerifier, gotNonce, err := LoadVaultMeta(db)
	if err != nil {
		t.Fatalf("LoadVaultMeta: %v", err)
	}
	if !bytes.Equal(gotSalt, salt) {
		t.Errorf("salt mismatch: got %x, want %x", gotSalt, salt)
	}
	if !bytes.Equal(gotVerifier, verifier) {
		t.Errorf("verifier mismatch: got %x, want %x", gotVerifier, verifier)
	}
	if !bytes.Equal(gotNonce, verifierNonce) {
		t.Errorf("nonce mismatch: got %x, want %x", gotNonce, verifierNonce)
	}
}

func TestVaultExists_TrueAfterSave(t *testing.T) {
	db := newTestDB(t)

	salt := []byte("saltsaltsaltsaltsaltsaltsaltsalt")
	if err := SaveVaultMeta(db, salt, nil, nil); err != nil {
		t.Fatalf("SaveVaultMeta: %v", err)
	}

	exists, err := VaultExists(db)
	if err != nil {
		t.Fatalf("VaultExists: %v", err)
	}
	if !exists {
		t.Error("expected VaultExists to return true after saving vault meta")
	}
}

func TestSaveVaultMeta_DuplicateInsertFails(t *testing.T) {
	db := newTestDB(t)

	salt := []byte("saltsaltsaltsaltsaltsaltsaltsalt")
	if err := SaveVaultMeta(db, salt, nil, nil); err != nil {
		t.Fatalf("first SaveVaultMeta: %v", err)
	}
	if err := SaveVaultMeta(db, salt, nil, nil); err == nil {
		t.Error("expected error on duplicate SaveVaultMeta, got nil")
	}
}
