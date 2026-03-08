package models

// RecordPlaintext is the decrypted JSON stored per record.
// Both types share this struct; unused fields are zero-valued and omitted in JSON.
type RecordPlaintext struct {
	Type      string   `json:"type"`                  // "password" | "api_key"
	Name      string   `json:"name"`
	Username  string   `json:"username,omitempty"`    // password type only
	Password  string   `json:"password,omitempty"`    // password type only
	SecretKey string   `json:"secret_key,omitempty"`  // api_key type only
	URL       string   `json:"url,omitempty"`          // password type only
	Notes     string   `json:"notes,omitempty"`
	Tags      []string `json:"tags,omitempty"`
}

// RecordSummary is returned by RecordList — no sensitive fields.
type RecordSummary struct {
	ID             string `json:"id"`
	Type           string `json:"type"`            // "password" | "api_key"
	Name           string `json:"name"`
	UsernameMasked string `json:"username_masked"` // e.g. "hel*****ld"; empty for api_key
	CreatedAt      int64  `json:"created_at"`
	UpdatedAt      int64  `json:"updated_at"`
}

// RecordDetail is returned by RecordGet — includes decrypted sensitive fields.
type RecordDetail struct {
	RecordSummary
	Username  string   `json:"username,omitempty"`   // password type only
	Password  string   `json:"password,omitempty"`   // password type only
	SecretKey string   `json:"secret_key,omitempty"` // api_key type only
	URL       string   `json:"url,omitempty"`         // password type only
	Notes     string   `json:"notes,omitempty"`
	Tags      []string `json:"tags,omitempty"`
}

// RecordInput is the payload for create and update operations.
type RecordInput struct {
	Type      string   `json:"type"`                  // "password" | "api_key"
	Name      string   `json:"name"`
	Username  string   `json:"username,omitempty"`    // password type only
	Password  string   `json:"password,omitempty"`    // password type only
	SecretKey string   `json:"secret_key,omitempty"`  // api_key type only
	URL       string   `json:"url,omitempty"`          // password type only
	Notes     string   `json:"notes,omitempty"`
	Tags      []string `json:"tags,omitempty"`
}

// GeneratorOptions controls the password generator.
type GeneratorOptions struct {
	Length       int  `json:"length"`
	UseSymbols   bool `json:"use_symbols"`
	UseNumbers   bool `json:"use_numbers"`
	UseUppercase bool `json:"use_uppercase"`
}

// SecretHistory is a single entry in the secret field history for a record.
// Applies to both password (stores previous password) and api_key (stores previous key) types.
type SecretHistory struct {
	ID         string `json:"id"`
	RecordID   string `json:"record_id"`
	Secret     string `json:"secret"`      // decrypted previous value
	ReplacedAt int64  `json:"replaced_at"`
}
