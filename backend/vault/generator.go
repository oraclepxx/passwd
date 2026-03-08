package vault

import (
	"crypto/rand"
	"fmt"
	"math/big"

	"github.com/oraclepxx/passwd/backend/models"
)

const (
	charLower   = "abcdefghijklmnopqrstuvwxyz"
	charUpper   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	charNumbers = "0123456789"
	charSymbols = "!@#$%^&*()-_=+[]{}|;:,.<>?"
)

// Generate produces a random password according to the given options.
// Returns an error if length < 8.
func Generate(opts models.GeneratorOptions) (string, error) {
	if opts.Length < 8 {
		return "", fmt.Errorf("password length must be at least 8, got %d", opts.Length)
	}

	// 4-11-1: Build pool from enabled sets (lowercase always included).
	pool := charLower
	if opts.UseUppercase {
		pool += charUpper
	}
	if opts.UseNumbers {
		pool += charNumbers
	}
	if opts.UseSymbols {
		pool += charSymbols
	}

	result := make([]byte, opts.Length)
	pos := 0

	// 4-11-2: Guarantee at least one char from each enabled set.
	mustInclude := []string{charLower}
	if opts.UseUppercase {
		mustInclude = append(mustInclude, charUpper)
	}
	if opts.UseNumbers {
		mustInclude = append(mustInclude, charNumbers)
	}
	if opts.UseSymbols {
		mustInclude = append(mustInclude, charSymbols)
	}

	for _, set := range mustInclude {
		ch, err := randomChar(set)
		if err != nil {
			return "", err
		}
		result[pos] = ch
		pos++
	}

	// 4-11-3: Fill remaining positions from the full pool.
	for pos < opts.Length {
		ch, err := randomChar(pool)
		if err != nil {
			return "", err
		}
		result[pos] = ch
		pos++
	}

	// 4-11-4: Fisher-Yates shuffle using crypto/rand.
	for i := opts.Length - 1; i > 0; i-- {
		jBig, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return "", fmt.Errorf("shuffle rand: %w", err)
		}
		j := int(jBig.Int64())
		result[i], result[j] = result[j], result[i]
	}

	return string(result), nil
}

// randomChar picks one random character from the given set using crypto/rand.
func randomChar(set string) (byte, error) {
	idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(set))))
	if err != nil {
		return 0, fmt.Errorf("random char: %w", err)
	}
	return set[idx.Int64()], nil
}
