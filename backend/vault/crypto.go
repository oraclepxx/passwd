package vault

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
	"io"

	"golang.org/x/crypto/argon2"
)

const (
	argon2Memory  = 65536
	argon2Time    = 3
	argon2Threads = 4
	argon2KeyLen  = 32
	nonceSize     = 12
)

// DeriveKey derives a 32-byte vault key from a password and salt using Argon2id.
func DeriveKey(password []byte, salt []byte) ([32]byte, error) {
	raw := argon2.IDKey(password, salt, argon2Time, argon2Memory, argon2Threads, argon2KeyLen)
	var key [32]byte
	copy(key[:], raw)
	clear(raw)
	return key, nil
}

// Encrypt encrypts plaintext with AES-256-GCM using the given key.
// A fresh 12-byte nonce is generated via crypto/rand for every call.
// Returns ciphertext (with auth tag appended) and the nonce separately.
func Encrypt(key [32]byte, plaintext []byte) (ciphertext []byte, nonce []byte, err error) {
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, nil, fmt.Errorf("new cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("new gcm: %w", err)
	}

	nonce = make([]byte, nonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("generate nonce: %w", err)
	}

	ciphertext = gcm.Seal(nil, nonce, plaintext, nil)
	return ciphertext, nonce, nil
}

// Decrypt decrypts and authenticates ciphertext with AES-256-GCM.
// Returns an error if authentication fails (tampered data or wrong key).
func Decrypt(key [32]byte, ciphertext []byte, nonce []byte) ([]byte, error) {
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt: %w", err)
	}

	return plaintext, nil
}
