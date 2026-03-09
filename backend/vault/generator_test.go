package vault

import (
	"strings"
	"testing"
	"unicode"

	"github.com/oraclepxx/passwd/backend/models"
)

func TestGenerate_LowercaseOnly(t *testing.T) {
	// All optional sets disabled — result should contain only lowercase letters.
	opts := models.GeneratorOptions{
		Length:       12,
		UseUppercase: false,
		UseNumbers:   false,
		UseSymbols:   false,
	}
	pw, err := Generate(opts)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	for _, ch := range pw {
		if !unicode.IsLower(ch) {
			t.Errorf("expected only lowercase, got char %q in %q", ch, pw)
		}
	}
}

func TestGenerate_NoUppercaseWhenDisabled(t *testing.T) {
	opts := models.GeneratorOptions{Length: 32, UseUppercase: false, UseNumbers: true, UseSymbols: true}
	pw, err := Generate(opts)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if strings.ContainsAny(pw, charUpper) {
		t.Errorf("expected no uppercase chars, got %q", pw)
	}
}

func TestGenerate_NoNumbersWhenDisabled(t *testing.T) {
	opts := models.GeneratorOptions{Length: 32, UseUppercase: true, UseNumbers: false, UseSymbols: true}
	pw, err := Generate(opts)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if strings.ContainsAny(pw, charNumbers) {
		t.Errorf("expected no number chars, got %q", pw)
	}
}

func TestGenerate_NoSymbolsWhenDisabled(t *testing.T) {
	opts := models.GeneratorOptions{Length: 32, UseUppercase: true, UseNumbers: true, UseSymbols: false}
	pw, err := Generate(opts)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if strings.ContainsAny(pw, charSymbols) {
		t.Errorf("expected no symbol chars, got %q", pw)
	}
}

func TestGenerate_LengthBoundaries(t *testing.T) {
	for _, length := range []int{8, 16, 32, 64} {
		opts := models.GeneratorOptions{Length: length, UseUppercase: true, UseNumbers: true, UseSymbols: true}
		pw, err := Generate(opts)
		if err != nil {
			t.Fatalf("Generate(length=%d): %v", length, err)
		}
		if len(pw) != length {
			t.Errorf("length=%d: got len %d", length, len(pw))
		}
	}
}

func TestGenerate_UniqueOutputs(t *testing.T) {
	opts := models.GeneratorOptions{Length: 20, UseUppercase: true, UseNumbers: true, UseSymbols: true}
	seen := make(map[string]bool)
	for i := 0; i < 20; i++ {
		pw, err := Generate(opts)
		if err != nil {
			t.Fatalf("Generate: %v", err)
		}
		if seen[pw] {
			t.Errorf("duplicate password generated: %q", pw)
		}
		seen[pw] = true
	}
}

func TestGenerate_AtLeastOneFromEachEnabledSet(t *testing.T) {
	// Run many iterations to statistically confirm the guarantee holds.
	opts := models.GeneratorOptions{Length: 8, UseUppercase: true, UseNumbers: true, UseSymbols: true}
	for i := 0; i < 50; i++ {
		pw, err := Generate(opts)
		if err != nil {
			t.Fatalf("Generate: %v", err)
		}
		if !strings.ContainsAny(pw, charLower) {
			t.Errorf("iter %d: missing lowercase in %q", i, pw)
		}
		if !strings.ContainsAny(pw, charUpper) {
			t.Errorf("iter %d: missing uppercase in %q", i, pw)
		}
		if !strings.ContainsAny(pw, charNumbers) {
			t.Errorf("iter %d: missing number in %q", i, pw)
		}
		if !strings.ContainsAny(pw, charSymbols) {
			t.Errorf("iter %d: missing symbol in %q", i, pw)
		}
	}
}
