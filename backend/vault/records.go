package vault

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/oraclepxx/passwd/backend/models"
)

// maskUsername partially masks a username per the design spec:
// first 3 chars + stars + last 2 chars. If len <= 5, all stars.
func maskUsername(username string) string {
	runes := []rune(username)
	n := len(runes)
	if n <= 5 {
		return strings.Repeat("*", n)
	}
	prefix := string(runes[:3])
	suffix := string(runes[n-2:])
	stars := strings.Repeat("*", n-5)
	return prefix + stars + suffix
}

// CreateRecord encrypts and inserts a new credential record.
func CreateRecord(db *DB, key [32]byte, input models.RecordInput) (string, error) {
	plain := models.RecordPlaintext{
		Type:      input.Type,
		Name:      input.Name,
		Username:  input.Username,
		Password:  input.Password,
		SecretKey: input.SecretKey,
		URL:       input.URL,
		Notes:     input.Notes,
		Tags:      input.Tags,
	}

	plainJSON, err := json.Marshal(plain)
	if err != nil {
		return "", fmt.Errorf("marshal: %w", err)
	}

	ciphertext, nonce, err := Encrypt(key, plainJSON)
	if err != nil {
		return "", fmt.Errorf("encrypt: %w", err)
	}

	id := uuid.New().String()
	hint := buildSearchHint(input.Type, input.Name, input.Username)
	now := time.Now().Unix()

	_, err = db.conn.Exec(
		`INSERT INTO records (id, record_type, ciphertext, nonce, created_at, updated_at, search_hint)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, input.Type, ciphertext, nonce, now, now, hint,
	)
	if err != nil {
		return "", fmt.Errorf("insert: %w", err)
	}

	return id, nil
}

// buildSearchHint constructs the unencrypted search hint for a record.
// For password type: "name\tusername" (lowercased).
// For api_key type: "name" (lowercased only).
func buildSearchHint(recordType, name, username string) string {
	if recordType == "api_key" {
		return strings.ToLower(name)
	}
	return strings.ToLower(name + "\t" + username)
}

// ListRecords returns summaries of active records, optionally filtered by query.
func ListRecords(db *DB, query string) ([]models.RecordSummary, error) {
	const baseQ = `SELECT id, record_type, search_hint, created_at, updated_at FROM records
	               WHERE deleted_at IS NULL ORDER BY updated_at DESC`
	const filterQ = `SELECT id, record_type, search_hint, created_at, updated_at FROM records
	                 WHERE deleted_at IS NULL AND search_hint LIKE ?
	                 ORDER BY updated_at DESC`

	args := []any{}
	q := baseQ
	if query != "" {
		q = filterQ
		args = append(args, "%"+strings.ToLower(query)+"%")
	}
	rows, err := db.conn.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()

	var summaries []models.RecordSummary
	for rows.Next() {
		var s models.RecordSummary
		var hint string
		if err := rows.Scan(&s.ID, &s.Type, &hint, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		parts := strings.SplitN(hint, "\t", 2)
		s.Name = parts[0]
		if s.Type == "password" && len(parts) == 2 {
			s.UsernameMasked = maskUsername(parts[1])
		}
		summaries = append(summaries, s)
	}
	return summaries, rows.Err()
}

// GetRecord decrypts and returns the full detail of a single record.
func GetRecord(db *DB, key [32]byte, id string) (models.RecordDetail, error) {
	var ciphertext, nonce []byte
	var createdAt, updatedAt int64
	var hint, recordType string

	err := db.conn.QueryRow(
		`SELECT record_type, ciphertext, nonce, created_at, updated_at, search_hint
		 FROM records WHERE id = ? AND deleted_at IS NULL`,
		id,
	).Scan(&recordType, &ciphertext, &nonce, &createdAt, &updatedAt, &hint)
	if err != nil {
		return models.RecordDetail{}, models.ErrRecordNotFound
	}

	plainJSON, err := Decrypt(key, ciphertext, nonce)
	if err != nil {
		return models.RecordDetail{}, fmt.Errorf("decrypt: %w", err)
	}

	var plain models.RecordPlaintext
	if err := json.Unmarshal(plainJSON, &plain); err != nil {
		return models.RecordDetail{}, fmt.Errorf("unmarshal: %w", err)
	}

	masked := ""
	if recordType == "password" {
		parts := strings.SplitN(hint, "\t", 2)
		if len(parts) == 2 {
			masked = maskUsername(parts[1])
		}
	}

	return models.RecordDetail{
		RecordSummary: models.RecordSummary{
			ID:             id,
			Type:           recordType,
			Name:           plain.Name,
			UsernameMasked: masked,
			CreatedAt:      createdAt,
			UpdatedAt:      updatedAt,
		},
		Username:  plain.Username,
		Password:  plain.Password,
		SecretKey: plain.SecretKey,
		URL:       plain.URL,
		Notes:     plain.Notes,
		Tags:      plain.Tags,
	}, nil
}

// UpdateRecord re-encrypts a record. If the secret field changed, the old value is
// saved to secret_history (capped at 5 entries).
func UpdateRecord(db *DB, key [32]byte, id string, input models.RecordInput) error {
	// Fetch current record to check if the secret field changed.
	current, err := GetRecord(db, key, id)
	if err != nil {
		return err
	}

	// Determine old and new secret values based on record type.
	oldSecret, newSecret := current.Password, input.Password
	if current.Type == "api_key" {
		oldSecret, newSecret = current.SecretKey, input.SecretKey
	}
	if oldSecret != newSecret {
		if err := saveSecretHistory(db, key, id, oldSecret); err != nil {
			return fmt.Errorf("save history: %w", err)
		}
	}

	plain := models.RecordPlaintext{
		Type:      current.Type,
		Name:      input.Name,
		Username:  input.Username,
		Password:  input.Password,
		SecretKey: input.SecretKey,
		URL:       input.URL,
		Notes:     input.Notes,
		Tags:      input.Tags,
	}

	plainJSON, err := json.Marshal(plain)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	ciphertext, nonce, err := Encrypt(key, plainJSON)
	if err != nil {
		return fmt.Errorf("encrypt: %w", err)
	}

	hint := buildSearchHint(current.Type, input.Name, input.Username)
	now := time.Now().Unix()

	_, err = db.conn.Exec(
		`UPDATE records SET ciphertext=?, nonce=?, updated_at=?, search_hint=?
		 WHERE id=? AND deleted_at IS NULL`,
		ciphertext, nonce, now, hint, id,
	)
	return err
}

// saveSecretHistory encrypts the old secret value and inserts it into secret_history,
// pruning to the last 5 entries.
func saveSecretHistory(db *DB, key [32]byte, recordID, oldSecret string) error {
	ciphertext, nonce, err := Encrypt(key, []byte(oldSecret))
	if err != nil {
		return err
	}

	histID := uuid.New().String()
	now := time.Now().Unix()

	_, err = db.conn.Exec(
		`INSERT INTO secret_history (id, record_id, ciphertext, nonce, replaced_at)
		 VALUES (?, ?, ?, ?, ?)`,
		histID, recordID, ciphertext, nonce, now,
	)
	if err != nil {
		return err
	}

	// Prune to last 5.
	_, err = db.conn.Exec(
		`DELETE FROM secret_history
		 WHERE record_id = ? AND id NOT IN (
		   SELECT id FROM secret_history
		   WHERE record_id = ?
		   ORDER BY replaced_at DESC
		   LIMIT 5
		 )`,
		recordID, recordID,
	)
	return err
}

// ListDeletedRecords returns summaries of soft-deleted (trash) records.
func ListDeletedRecords(db *DB) ([]models.RecordSummary, error) {
	rows, err := db.conn.Query(
		`SELECT id, search_hint, created_at, updated_at FROM records
		 WHERE deleted_at IS NOT NULL ORDER BY updated_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()

	var summaries []models.RecordSummary
	for rows.Next() {
		var s models.RecordSummary
		var hint string
		if err := rows.Scan(&s.ID, &hint, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		parts := strings.SplitN(hint, "\t", 2)
		s.Name = parts[0]
		if len(parts) == 2 {
			s.UsernameMasked = maskUsername(parts[1])
		}
		summaries = append(summaries, s)
	}
	return summaries, rows.Err()
}

// DeleteRecord soft-deletes a record by setting deleted_at.
func DeleteRecord(db *DB, id string) error {
	_, err := db.conn.Exec(
		`UPDATE records SET deleted_at=? WHERE id=? AND deleted_at IS NULL`,
		time.Now().Unix(), id,
	)
	return err
}

// RestoreRecord clears deleted_at, moving the record back to active.
func RestoreRecord(db *DB, id string) error {
	_, err := db.conn.Exec(
		`UPDATE records SET deleted_at=NULL WHERE id=? AND deleted_at IS NOT NULL`, id,
	)
	return err
}

// PurgeRecord permanently deletes a soft-deleted record.
func PurgeRecord(db *DB, id string) error {
	res, err := db.conn.Exec(
		`DELETE FROM records WHERE id=? AND deleted_at IS NOT NULL`, id,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return models.ErrRecordNotFound
	}
	return nil
}

// GetHistory returns the last 5 decrypted secret field history entries for a record.
func GetHistory(db *DB, key [32]byte, recordID string) ([]models.SecretHistory, error) {
	rows, err := db.conn.Query(
		`SELECT id, ciphertext, nonce, replaced_at FROM secret_history
		 WHERE record_id=? ORDER BY replaced_at DESC LIMIT 5`,
		recordID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []models.SecretHistory
	for rows.Next() {
		var h models.SecretHistory
		var ciphertext, nonce []byte
		if err := rows.Scan(&h.ID, &ciphertext, &nonce, &h.ReplacedAt); err != nil {
			return nil, err
		}
		plain, err := Decrypt(key, ciphertext, nonce)
		if err != nil {
			return nil, fmt.Errorf("decrypt history: %w", err)
		}
		h.RecordID = recordID
		h.Secret = string(plain)
		history = append(history, h)
	}
	return history, rows.Err()
}

// PurgeExpiredTrash permanently deletes records soft-deleted more than 30 days ago.
func PurgeExpiredTrash(db *DB) error {
	cutoff := time.Now().Unix() - 30*24*60*60
	_, err := db.conn.Exec(
		`DELETE FROM records WHERE deleted_at IS NOT NULL AND deleted_at < ?`, cutoff,
	)
	return err
}
