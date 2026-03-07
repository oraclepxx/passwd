package vault

import (
	"sync"

	"passwd/backend/models"
)

// VaultSession holds the in-memory vault key and lock state.
// All fields are protected by the embedded mutex.
type VaultSession struct {
	mu       sync.Mutex
	key      [32]byte
	unlocked bool
}

// IsUnlocked reports whether the vault is currently unlocked.
func (s *VaultSession) IsUnlocked() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.unlocked
}

// Key returns the vault key if the vault is unlocked.
func (s *VaultSession) Key() ([32]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.unlocked {
		return [32]byte{}, models.ErrVaultLocked
	}
	return s.key, nil
}

// Unlock stores the derived key and marks the vault as unlocked.
func (s *VaultSession) Unlock(key [32]byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.key = key
	s.unlocked = true
}

// Lock zeros the key from memory and marks the vault as locked.
func (s *VaultSession) Lock() {
	s.mu.Lock()
	defer s.mu.Unlock()
	clear(s.key[:])
	s.unlocked = false
}
