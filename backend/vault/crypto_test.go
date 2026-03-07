package vault

import (
	"bytes"
	"testing"
)

func TestEncryptDecrypt_RoundTrip(t *testing.T) {
	key, err := DeriveKey([]byte("test-password"), []byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatalf("DeriveKey: %v", err)
	}

	plaintext := []byte(`{"name":"GitHub","username":"user@example.com","password":"s3cr3t"}`)

	ciphertext, nonce, err := Encrypt(key, plaintext)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	got, err := Decrypt(key, ciphertext, nonce)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}

	if !bytes.Equal(got, plaintext) {
		t.Errorf("round-trip mismatch: got %q, want %q", got, plaintext)
	}
}

func TestDecrypt_TamperedCiphertext(t *testing.T) {
	key, _ := DeriveKey([]byte("test-password"), []byte("0123456789abcdef0123456789abcdef"))
	plaintext := []byte("sensitive data")

	ciphertext, nonce, err := Encrypt(key, plaintext)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	// Flip a byte in the ciphertext.
	ciphertext[0] ^= 0xff

	_, err = Decrypt(key, ciphertext, nonce)
	if err == nil {
		t.Error("expected error for tampered ciphertext, got nil")
	}
}

func TestEncrypt_UniqueNonces(t *testing.T) {
	key, _ := DeriveKey([]byte("test-password"), []byte("0123456789abcdef0123456789abcdef"))
	plaintext := []byte("same plaintext")

	_, nonce1, _ := Encrypt(key, plaintext)
	_, nonce2, _ := Encrypt(key, plaintext)

	if bytes.Equal(nonce1, nonce2) {
		t.Error("two encryptions produced the same nonce")
	}
}

func TestVaultSession_LockZerosKey(t *testing.T) {
	s := &VaultSession{}
	key, _ := DeriveKey([]byte("password"), []byte("0123456789abcdef0123456789abcdef"))
	s.Unlock(key)

	if !s.IsUnlocked() {
		t.Fatal("expected session to be unlocked")
	}

	s.Lock()

	if s.IsUnlocked() {
		t.Error("expected session to be locked after Lock()")
	}
	if s.key != ([32]byte{}) {
		t.Error("expected key to be zeroed after Lock()")
	}
}

func TestVaultSession_KeyReturnsErrorWhenLocked(t *testing.T) {
	s := &VaultSession{}
	_, err := s.Key()
	if err == nil {
		t.Error("expected error from Key() when locked")
	}
}
