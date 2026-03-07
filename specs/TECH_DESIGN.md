# Technical Design Document: passwd

## 1. Architecture Overview

**Chosen stack:** Tauri v2 (Rust backend + WebView frontend)

```
┌─────────────────────────────────────────┐
│              Frontend (WebView)          │
│         React + TypeScript + Tailwind    │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │ ListView │  │DetailView│  │Forms  │ │
│  └──────────┘  └──────────┘  └───────┘ │
└──────────────────┬──────────────────────┘
                   │ Tauri IPC (invoke)
┌──────────────────▼──────────────────────┐
│              Rust Backend               │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │VaultCore │  │CryptoSvc │  │DBSvc  │ │
│  └──────────┘  └──────────┘  └───────┘ │
│                                         │
│              SQLite (rusqlite)          │
└─────────────────────────────────────────┘
```

The frontend handles all UI/UX. The Rust backend owns all crypto operations, database access, and session state. The frontend never touches raw plaintext passwords in a way that could leak — all sensitive data crosses the IPC boundary only when explicitly requested.

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
    ciphertext  BLOB NOT NULL,        -- AES-256-GCM encrypted JSON
    nonce       BLOB NOT NULL,        -- 12-byte GCM nonce (unique per record)
    created_at  INTEGER NOT NULL,     -- Unix timestamp
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER,              -- NULL = active; set = soft-deleted
    search_hint TEXT NOT NULL         -- Unencrypted: name + username (for search)
);

-- Password history (per record, last 5)
CREATE TABLE password_history (
    id          TEXT PRIMARY KEY,
    record_id   TEXT NOT NULL REFERENCES records(id),
    ciphertext  BLOB NOT NULL,        -- Encrypted previous password
    nonce       BLOB NOT NULL,
    replaced_at INTEGER NOT NULL
);

CREATE INDEX idx_records_deleted_at ON records(deleted_at);
CREATE INDEX idx_records_search     ON records(search_hint);
CREATE INDEX idx_history_record     ON password_history(record_id);
```

### 2.2 Record Plaintext Structure (encrypted JSON)

```typescript
interface RecordPlaintext {
  name: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  tags?: string[];
}
```

### 2.3 search_hint Field

`search_hint` is stored **unencrypted** to support fast filtering without decrypting every record. It contains only `name` and `username` — no passwords, URLs, or notes.

Format: `{name}\t{username}` (tab-separated, lowercased).

This is an intentional privacy tradeoff: name and username are low-sensitivity metadata. Password, URL, and notes remain fully encrypted.

---

## 3. Encryption Design

### 3.1 Key Derivation

```
master_password  +  salt (32 bytes, from vault_meta)
        │
        ▼
   Argon2id (m=65536 KB, t=3, p=4)
        │
        ▼
   vault_key (32 bytes)  ← held in memory only, never persisted
```

- Salt is generated once at vault creation using `OsRng`
- `vault_key` is derived fresh on each unlock and zeroed on lock

### 3.2 Record Encryption

Each record is encrypted independently:

```
plaintext_json  +  nonce (12 bytes, random per save)
        │
        ▼
   AES-256-GCM (vault_key)
        │
        ▼
   ciphertext + 16-byte auth tag  →  stored in records.ciphertext
```

- Nonce is regenerated on every write (including edits)
- The auth tag is appended to ciphertext in storage
- Crate: `aes-gcm` (RustCrypto, audited)

### 3.3 Memory Hygiene

- `vault_key` stored as `Zeroizing<[u8; 32]>` — zeroed on drop
- Master password string zeroed after key derivation
- Decrypted plaintext structs implement `Zeroize`
- Session state (vault key + unlock status) lives in a `Mutex<Option<VaultSession>>` in Tauri state

---

## 4. Backend Modules (Rust)

### 4.1 Module Structure

```
src-tauri/src/
├── main.rs           # Tauri setup, command registration
├── commands.rs       # All #[tauri::command] handlers (thin layer)
├── vault/
│   ├── mod.rs
│   ├── session.rs    # VaultSession: key + lock state
│   ├── crypto.rs     # encrypt/decrypt, key derivation
│   ├── db.rs         # SQLite queries via rusqlite
│   ├── records.rs    # CRUD business logic
│   └── generator.rs  # Password generation
└── error.rs          # Unified error type
```

### 4.2 Tauri Commands (IPC API)

| Command | Input | Output | Notes |
|---------|-------|--------|-------|
| `vault_create` | `{ password: string }` | `Ok` | First-run setup |
| `vault_unlock` | `{ password: string }` | `Ok / Err` | Derives key, stores in session |
| `vault_lock` | — | `Ok` | Zeroes key from memory |
| `vault_is_unlocked` | — | `bool` | |
| `record_create` | `RecordInput` | `RecordId` | |
| `record_list` | `{ query?: string }` | `Vec<RecordSummary>` | Filtered by search_hint |
| `record_get` | `{ id: string }` | `RecordDetail` | Decrypts on demand |
| `record_update` | `{ id, data: RecordInput }` | `Ok` | Saves history if password changed |
| `record_delete` | `{ id: string }` | `Ok` | Soft delete |
| `record_restore` | `{ id: string }` | `Ok` | Un-soft-delete |
| `record_purge` | `{ id: string }` | `Ok` | Permanent delete |
| `record_history` | `{ id: string }` | `Vec<PasswordHistory>` | Last 5 password versions |
| `password_generate` | `GeneratorOptions` | `string` | |
| `clipboard_copy` | `{ value: string, timeout_secs: u32 }` | `Ok` | Schedules clear via OS API |

### 4.3 Response Types (TypeScript)

```typescript
interface RecordSummary {
  id: string;
  name: string;
  username_masked: string;  // e.g. "hel*****ld"
  created_at: number;
  updated_at: number;
}

interface RecordDetail extends RecordSummary {
  username: string;         // full, unmasked
  password: string;         // plaintext (only sent on explicit get)
  url?: string;
  notes?: string;
  tags?: string[];
}

interface GeneratorOptions {
  length: number;           // default: 20
  use_symbols: boolean;     // default: true
  use_numbers: boolean;     // default: true
  use_uppercase: boolean;   // default: true
}
```

---

## 5. Username Masking Logic

Applied in Rust before returning `RecordSummary`:

```rust
fn mask_username(username: &str) -> String {
    let chars: Vec<char> = username.chars().collect();
    let len = chars.len();
    if len <= 5 {
        return "*".repeat(len);
    }
    let prefix: String = chars[..3].iter().collect();
    let suffix: String = chars[len - 2..].iter().collect();
    let stars = "*".repeat(len - 5);
    format!("{}{}{}", prefix, stars, suffix)
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
src/
├── App.tsx                  # Route: lock screen vs main app
├── views/
│   ├── LockView.tsx         # Master password input
│   ├── ListView.tsx         # Search + record list
│   ├── DetailView.tsx       # Record detail, reveal/copy
│   └── FormView.tsx         # Create / Edit form
├── components/
│   ├── RecordCard.tsx       # Single record in list
│   ├── PasswordField.tsx    # Input with show/hide + generate
│   ├── ConfirmDialog.tsx    # Reusable confirmation modal
│   └── TagBadge.tsx
├── hooks/
│   ├── useVault.ts          # Unlock state, auto-lock timer
│   ├── useRecords.ts        # CRUD operations via invoke()
│   └── useClipboard.ts      # Copy + clear timer
└── lib/
    └── tauri.ts             # Typed wrappers around invoke()
```

### 6.1 State Management

No external state library needed. React context + `useReducer` for:
- `VaultContext`: unlock status, auto-lock countdown
- `RecordsContext`: list cache, selected record

### 6.2 Auto-lock

A timer resets on any user interaction (mousemove, keydown). On expiry, `vault_lock` is called and the UI returns to `LockView`. Timer default: 5 minutes (user-configurable in settings).

---

## 7. Password Generator

Implemented in Rust (`generator.rs`) using `OsRng`:

```rust
pub struct GeneratorOptions {
    pub length: usize,
    pub use_symbols: bool,
    pub use_numbers: bool,
    pub use_uppercase: bool,
}

// Character pool built from enabled sets, then:
// 1. Pick one char from each enabled set (guarantee inclusion)
// 2. Fill remaining length from full pool randomly
// 3. Shuffle result with Fisher-Yates
```

Minimum length: 8. Default: 20.

---

## 8. Password History

On `record_update`, if the password field changed:

1. Insert current encrypted password into `password_history`
2. Delete oldest entries beyond the 5-record limit:
   ```sql
   DELETE FROM password_history
   WHERE record_id = ?
     AND id NOT IN (
       SELECT id FROM password_history
       WHERE record_id = ?
       ORDER BY replaced_at DESC
       LIMIT 5
     )
   ```

History entries are encrypted with the same `vault_key` + fresh nonce.

---

## 9. Trash / Soft Delete

- `record_delete`: sets `deleted_at = now()`
- `record_list` default: `WHERE deleted_at IS NULL`
- Trash view: `WHERE deleted_at IS NOT NULL`
- `record_restore`: sets `deleted_at = NULL`
- `record_purge`: hard `DELETE` (requires `deleted_at IS NOT NULL` guard)
- Automatic purge of items older than 30 days runs on vault unlock

---

## 10. File Layout

```
passwd/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── commands.rs
│       ├── error.rs
│       └── vault/
│           ├── mod.rs
│           ├── session.rs
│           ├── crypto.rs
│           ├── db.rs
│           ├── records.rs
│           └── generator.rs
├── src/                     # Frontend
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── PRD.md
├── TECH_DESIGN.md
└── RESEARCH.md
```

---

## 11. Key Dependencies

### Rust (Cargo.toml)
| Crate | Purpose |
|-------|---------|
| `tauri` v2 | App framework |
| `rusqlite` | SQLite |
| `aes-gcm` | AES-256-GCM encryption |
| `argon2` | Key derivation |
| `zeroize` | Memory hygiene |
| `rand` | Cryptographic RNG |
| `uuid` | Record IDs |
| `serde` / `serde_json` | Serialization |

### Frontend (package.json)
| Package | Purpose |
|---------|---------|
| `@tauri-apps/api` | IPC invoke |
| `react` + `react-dom` | UI |
| `typescript` | Type safety |
| `tailwindcss` | Styling |
| `vite` | Build tool |

---

## 12. Security Checklist

- [ ] `vault_key` uses `Zeroizing<[u8; 32]>` — zeroed on drop
- [ ] Nonce is unique per encryption operation (random `OsRng`)
- [ ] `search_hint` contains only name + username, never password/URL/notes
- [ ] All Tauri commands check `vault_is_unlocked()` before operating on records
- [ ] No outbound network requests — Tauri CSP set to deny all external origins
- [ ] Clipboard cleared after configurable timeout via OS clipboard API
- [ ] Trash items older than 30 days auto-purged on unlock
- [ ] Export (P3) must use same AES-256-GCM + fresh salt before writing to disk
