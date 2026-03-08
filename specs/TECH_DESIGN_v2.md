# Technical Design Document v2: passwd (Go + Wails)

## 1. Architecture Overview

**Chosen stack:** Wails v2 (Go backend + WebView frontend)

```
┌─────────────────────────────────────────┐
│              Frontend (WebView)          │
│         React + TypeScript + Tailwind    │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │ ListView │  │DetailView│  │Forms  │ │
│  └──────────┘  └──────────┘  └───────┘ │
└──────────────────┬──────────────────────┘
                   │ Wails runtime (JS bridge)
┌──────────────────▼──────────────────────┐
│              Go Backend                 │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │VaultSvc  │  │CryptoSvc │  │DBSvc  │ │
│  └──────────┘  └──────────┘  └───────┘ │
│                                         │
│         SQLite (modernc.org/sqlite)     │
└─────────────────────────────────────────┘
```

The frontend handles all UI/UX. The Go backend owns all crypto operations, database access, and session state. All sensitive data (plaintext passwords, vault key) lives only in Go memory — it crosses the JS bridge only on explicit user request.

---

## 2. Data Model

### 2.1 Database Schema (SQLite)

```sql
-- Vault metadata (one row)
CREATE TABLE vault_meta (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    salt        BLOB NOT NULL,        -- Argon2id salt (32 bytes)
    version     INTEGER NOT NULL DEFAULT 1
);

-- Encrypted records
CREATE TABLE records (
    id          TEXT PRIMARY KEY,     -- UUID v4
    record_type TEXT NOT NULL DEFAULT 'password', -- 'password' | 'api_key'
    ciphertext  BLOB NOT NULL,        -- AES-256-GCM encrypted JSON
    nonce       BLOB NOT NULL,        -- 12-byte GCM nonce (unique per record)
    created_at  INTEGER NOT NULL,     -- Unix timestamp
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER,              -- NULL = active; set = soft-deleted
    search_hint TEXT NOT NULL         -- Unencrypted: name (+ username for password type)
);

-- Secret field history (per record, last 5) — applies to password and api_key records
CREATE TABLE secret_history (
    id          TEXT PRIMARY KEY,
    record_id   TEXT NOT NULL REFERENCES records(id),
    ciphertext  BLOB NOT NULL,        -- Encrypted previous secret value
    nonce       BLOB NOT NULL,
    replaced_at INTEGER NOT NULL
);

CREATE INDEX idx_records_deleted_at ON records(deleted_at);
CREATE INDEX idx_records_search     ON records(search_hint);
CREATE INDEX idx_history_record     ON secret_history(record_id);
```

### 2.2 Record Plaintext Structure (encrypted JSON)

Records have two types. The `type` field determines which fields are present:

**Password record:**
```go
type RecordPlaintext struct {
    Type     string   `json:"type"`              // "password"
    Name     string   `json:"name"`
    Username string   `json:"username"`
    Password string   `json:"password"`
    URL      string   `json:"url,omitempty"`
    Notes    string   `json:"notes,omitempty"`
    Tags     []string `json:"tags,omitempty"`
}
```

**API Key record:**
```go
type RecordPlaintext struct {
    Type      string   `json:"type"`             // "api_key"
    Name      string   `json:"name"`
    SecretKey string   `json:"secret_key"`       // the API key / token value
    Notes     string   `json:"notes,omitempty"`
    Tags      []string `json:"tags,omitempty"`
}
```

Both types share the same `RecordPlaintext` struct in Go (unused fields are zero-valued and omitted in JSON).

### 2.3 search_hint Field

`search_hint` is stored **unencrypted** to support fast filtering without decrypting every record. It never contains passwords, secret keys, URLs, or notes.

- **Password type:** `{name}\t{username}` (tab-separated, lowercased)
- **API key type:** `{name}` (lowercased only; no username)

This is an intentional privacy tradeoff: name and username are low-sensitivity metadata. All secret values remain fully encrypted.

---

## 3. Encryption Design

### 3.1 Key Derivation

```
master_password  +  salt (32 bytes, from vault_meta)
        │
        ▼
   Argon2id (m=65536 KB, t=3, p=4)   ← golang.org/x/crypto/argon2
        │
        ▼
   vaultKey [32]byte  ← held in memory only, never persisted
```

- Salt generated once at vault creation using `crypto/rand`
- `vaultKey` derived fresh on each unlock, zeroed on lock by overwriting the byte slice

### 3.2 Record Encryption

Each record is encrypted independently:

```
plaintext JSON  +  nonce (12 bytes, random per save)
        │
        ▼
   AES-256-GCM (vaultKey)   ← crypto/aes + crypto/cipher (stdlib)
        │
        ▼
   ciphertext + 16-byte auth tag  →  stored in records.ciphertext
```

- Nonce is regenerated on every write (including edits) using `crypto/rand`
- The auth tag is appended to ciphertext in storage
- Uses Go standard library only — no third-party crypto packages

### 3.3 Memory Hygiene

Go does not provide Rust-level memory guarantees, but we apply best-effort hygiene:

- `vaultKey` stored as `[32]byte` on the `VaultSession` struct; zeroed with `clear(vaultKey[:])` on lock
- Master password string converted to `[]byte`, zeroed after key derivation
- Decrypted plaintext structs zeroed before GC via `runtime.SetFinalizer` (best-effort)
- Session state held in a `sync.Mutex`-protected `*VaultSession` on the App struct

---

## 4. Backend Modules (Go)

### 4.1 Module Structure

```
backend/
├── main.go               # Wails app entry point
├── app.go                # App struct — Wails binds this to frontend
├── vault/
│   ├── session.go        # VaultSession: key + lock state
│   ├── crypto.go         # Encrypt/decrypt, key derivation
│   ├── db.go             # SQLite queries via database/sql
│   ├── records.go        # CRUD business logic
│   └── generator.go      # Password generation
└── models/
    ├── record.go          # RecordPlaintext, RecordSummary, RecordDetail
    └── errors.go          # Sentinel errors
```

### 4.2 Wails Bound Methods (JS Bridge API)

All public methods on `App` are automatically bound to the frontend via the Wails runtime:

| Method | Input | Output | Notes |
|--------|-------|--------|-------|
| `VaultCreate` | `password string` | `error` | First-run setup |
| `VaultUnlock` | `password string` | `error` | Derives key, stores in session |
| `VaultLock` | — | `error` | Zeroes key from memory |
| `VaultIsUnlocked` | — | `bool` | |
| `RecordCreate` | `RecordInput` | `(string, error)` | Returns new record ID |
| `RecordList` | `query string` | `([]RecordSummary, error)` | Filtered by search_hint |
| `RecordGet` | `id string` | `(RecordDetail, error)` | Decrypts on demand |
| `RecordUpdate` | `id string, data RecordInput` | `error` | Saves history if secret field changed |
| `RecordDelete` | `id string` | `error` | Soft delete |
| `RecordRestore` | `id string` | `error` | Un-soft-delete |
| `RecordPurge` | `id string` | `error` | Permanent delete |
| `RecordHistory` | `id string` | `([]SecretHistory, error)` | Last 5 secret field versions |
| `PasswordGenerate` | `GeneratorOptions` | `(string, error)` | Password type only |
| `ClipboardCopy` | `value string, timeoutSecs int` | `error` | Schedules clear |

### 4.3 Go Structs / TypeScript Types

```go
// Go (models/record.go)
type RecordSummary struct {
    ID             string `json:"id"`
    Type           string `json:"type"`            // "password" | "api_key"
    Name           string `json:"name"`
    UsernameMasked string `json:"username_masked"` // e.g. "hel*****ld"; empty for api_key
    CreatedAt      int64  `json:"created_at"`
    UpdatedAt      int64  `json:"updated_at"`
}

type RecordDetail struct {
    RecordSummary
    Username  string   `json:"username,omitempty"`   // password type only
    Password  string   `json:"password,omitempty"`   // password type only
    SecretKey string   `json:"secret_key,omitempty"` // api_key type only
    URL       string   `json:"url,omitempty"`         // password type only
    Notes     string   `json:"notes,omitempty"`
    Tags      []string `json:"tags,omitempty"`
}

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

type SecretHistory struct {
    ID         string `json:"id"`
    RecordID   string `json:"record_id"`
    Secret     string `json:"secret"`      // decrypted previous value (password or api key)
    ReplacedAt int64  `json:"replaced_at"`
}

type GeneratorOptions struct {
    Length       int  `json:"length"`        // default: 20
    UseSymbols   bool `json:"use_symbols"`   // default: true
    UseNumbers   bool `json:"use_numbers"`   // default: true
    UseUppercase bool `json:"use_uppercase"` // default: true
}
```

Wails auto-generates TypeScript bindings from Go structs — no manual type definitions needed in the frontend.

---

## 5. Username Masking Logic

Applied in Go before returning `RecordSummary`. Only applies to `password` type records; `api_key` records return an empty `username_masked`.

```go
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
```

Examples:
- `helloworld` (10) → `hel*****ld`
- `ab` (2) → `**`
- `hello` (5) → `*****`
- `hi@example.com` (14) → `hi@*********om`

---

## 6. Frontend Structure (React)

```
frontend/
├── src/
│   ├── App.tsx                  # Route: lock screen vs main app
│   ├── views/
│   │   ├── LockView.tsx         # Master password input
│   │   ├── ListView.tsx         # Search + record list
│   │   ├── DetailView.tsx       # Record detail, reveal/copy
│   │   └── FormView.tsx         # Create / Edit form
│   ├── components/
│   │   ├── RecordCard.tsx       # Single record in list
│   │   ├── PasswordField.tsx    # Input with show/hide + generate
│   │   ├── ConfirmDialog.tsx    # Reusable confirmation modal
│   │   └── TagBadge.tsx
│   ├── hooks/
│   │   ├── useVault.ts          # Unlock state, auto-lock timer
│   │   ├── useRecords.ts        # CRUD via Wails bindings
│   │   └── useClipboard.ts      # Copy + clear timer
│   └── wailsjs/                 # Auto-generated by Wails (do not edit)
│       ├── go/                  # Go method bindings
│       └── runtime/             # Wails runtime helpers
├── index.html
└── vite.config.ts
```

### 6.1 Calling Go from the Frontend

Wails generates typed JS bindings in `wailsjs/go/`. Usage in React:

```typescript
import { RecordList, RecordGet, VaultUnlock } from '../wailsjs/go/main/App';

// In a hook:
const records = await RecordList(searchQuery);
const detail  = await RecordGet(id);
```

No manual `fetch` or IPC wiring needed.

### 6.2 State Management

React context + `useReducer` for:
- `VaultContext`: unlock status, auto-lock countdown
- `RecordsContext`: list cache, selected record

### 6.3 Auto-lock

A timer resets on any user interaction (mousemove, keydown). On expiry, `VaultLock()` is called and UI returns to `LockView`. Default: 5 minutes (user-configurable).

---

## 7. Password Generator

Implemented in Go (`vault/generator.go`) using `crypto/rand`:

```go
func Generate(opts GeneratorOptions) (string, error) {
    // 1. Build character pool from enabled sets
    // 2. Guarantee at least one char from each enabled set
    // 3. Fill remaining length from full pool using crypto/rand
    // 4. Fisher-Yates shuffle using crypto/rand
}
```

Minimum length: 8. Default: 20.

---

## 8. Secret Field History

On `RecordUpdate`, if the secret field changed (password for `password` type; secret key for `api_key` type):

1. Insert current encrypted secret value into `secret_history`
2. Prune to last 5 entries:

```sql
DELETE FROM secret_history
WHERE record_id = ?
  AND id NOT IN (
    SELECT id FROM secret_history
    WHERE record_id = ?
    ORDER BY replaced_at DESC
    LIMIT 5
  )
```

History entries encrypted with the same `vaultKey` + fresh nonce from `crypto/rand`.

---

## 9. Trash / Soft Delete

- `RecordDelete`: sets `deleted_at = now()`
- `RecordList` default: `WHERE deleted_at IS NULL`
- Trash view: `WHERE deleted_at IS NOT NULL`
- `RecordRestore`: sets `deleted_at = NULL`
- `RecordPurge`: hard `DELETE` (requires `deleted_at IS NOT NULL` guard)
- On `VaultUnlock`: auto-purge records where `deleted_at < now() - 30 days`

---

## 10. File Layout

```
passwd/
├── backend/
│   ├── main.go
│   ├── app.go
│   ├── vault/
│   │   ├── session.go
│   │   ├── crypto.go
│   │   ├── db.go
│   │   ├── records.go
│   │   └── generator.go
│   └── models/
│       ├── record.go
│       └── errors.go
├── frontend/
│   ├── src/
│   ├── index.html
│   └── vite.config.ts
├── wails.json
├── go.mod
├── go.sum
├── PRD.md
├── RESEARCH.md
├── TECH_DESIGN.md
└── TECH_DESIGN_v2.md
```

---

## 11. Key Dependencies

### Go (go.mod)
| Package | Purpose |
|---------|---------|
| `github.com/wailsapp/wails/v2` | App framework + JS bridge |
| `modernc.org/sqlite` | SQLite driver (pure Go, no CGo) |
| `golang.org/x/crypto/argon2` | Argon2id key derivation |
| `github.com/google/uuid` | Record UUIDs |
| `golang.org/x/sys` | OS clipboard access |

Go standard library handles: `crypto/aes`, `crypto/cipher`, `crypto/rand`, `database/sql`, `encoding/json`, `sync`

### Frontend (package.json)
| Package | Purpose |
|---------|---------|
| `react` + `react-dom` | UI |
| `typescript` | Type safety |
| `tailwindcss` | Styling |
| `vite` | Build tool |

No `@tauri-apps/api` needed — Wails auto-generates its own bindings.

---

## 12. Security Checklist

- [ ] `vaultKey` is a `[32]byte`; zeroed with `clear(vaultKey[:])` on lock
- [ ] All nonces generated with `crypto/rand` (never `math/rand`)
- [ ] `search_hint` contains only name + username (password type) or name only (api_key type); never secret values/URL/notes
- [ ] All bound methods check `VaultIsUnlocked()` before operating on records
- [ ] Wails CSP configured to deny all external network origins
- [ ] Clipboard cleared after configurable timeout
- [ ] Trash items older than 30 days auto-purged on unlock
- [ ] Export (P3) must re-encrypt with fresh salt before writing to disk
