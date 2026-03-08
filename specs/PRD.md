# Product Requirements Document: Personal Password Manager

## 1. App Summary & Target User

**App Name:** passwd (working title)

**Summary:**
A lightweight, local-first credentials (password or secret key) manager designed for simplicity. Unlike feature-heavy commercial alternatives (1Password, Bitwarden, LastPass), this app focuses exclusively on the core workflow: store, retrieve, edit, and delete credentials records — with no clutter.

**Target User:**
- Solo individual (personal use)
- Technical enough to self-host or run a local app
- Frustrated by the complexity or subscription cost of existing solutions
- Values ownership and simplicity over feature breadth

---

## 2. Functionality Details

### 2.1 Create Credentials Record

- User can create a new record with one of two types:

  **Type: Password**
  - **Name / Title** (required): e.g., "Gmail", "GitHub"
  - **Username / Email** (required)
  - **Password** (required): supports manual entry or auto-generation
  - **URL** (optional): associated website
  - **Notes** (optional): free-text field for extra context
  - **Tags** (optional): for grouping/filtering
  - Auto-generate password with configurable options: length, use of symbols, numbers, uppercase

  **Type: Secret API Key**
  - **Name / Title** (required): e.g., "OpenAI API Key", "AWS Secret Key"
  - **Key / Token** (required): the API key or secret value
  - **Notes** (optional): free-text field for extra context
  - **Tags** (optional): for grouping/filtering

- Both types treat their secret field (password / key) identically: hidden by default, reveal on explicit action, copyable with auto-clear

### 2.2 Retrieve Credentials Record

- Search/filter records by name, username, URL, or tags
- View record detail: all fields visible; username shown partially masked (first 3 chars + `***` + last 2 chars, e.g. `helloworld` → `hel*****ld`); password or secret key hidden by default
- Reveal password or secret key on explicit action (click/tap to show)
- One-click copy to clipboard for username and password/secret key
- Clipboard is cleared automatically after a configurable timeout (default: 30 seconds)

### 2.3 Edit Credentials Record

- Edit any field of an existing record
- Password/Secret key change logs previous value in a local history (last 5 versions, for recovery purposes)
- Save and cancel actions clearly presented

### 2.4 Delete Credentials Record

- Soft delete: move to trash with confirmation prompt
- Restore from trash within a grace period (e.g., 30 days)
- Permanent delete from trash with secondary confirmation

### 2.5 Change Master Password

- User can update the vault master password from within the app (vault must be unlocked)
- Requires entry of the current password for confirmation before accepting the new one
- New password must meet minimum length requirement (≥ 8 characters)
- On success: re-derives the vault key from the new password, re-encrypts the salt verifier, and updates the stored salt — all existing records remain accessible
- Session stays unlocked after a successful master password change

---

## 3. Feature Priority

| Priority | Feature | Rationale |
|----------|---------|-----------|
| P0 | Create record | Core CRUD — app is useless without this |
| P0 | Retrieve / search record | Core CRUD |
| P0 | Master password / vault unlock | Security baseline |
| P0 | Local encrypted storage | Data must be secure at rest |
| P1 | Edit record | Core CRUD |
| P1 | Delete record (soft) | Core CRUD |
| P1 | Copy to clipboard with auto-clear | Key usability feature |
| P1 | Password generator | Reduces friction for new records |
| P2 | Password history (last 5) | Safety net for edits |
| P2 | Tags / filtering | Organization for growing vaults |
| P2 | Trash / restore | Safety net for deletes |
| P2 | Secret API Key field | Store API tokens alongside passwords |
| P2 | Change master password | Credential hygiene and recovery |
| P3 | Export vault (encrypted backup) | Data portability |
| P3 | Import from CSV / other managers | Migration convenience |
| P3 | Auto-lock after inactivity | Additional security hardening |
| P3 | Manual-lock before inactivity | Additional security hardening |

---

## 4. UX/UI Design Requirements

### 4.1 Principles
- **Simplicity first:** One primary action per screen. No feature sprawl.
- **Speed:** Searching and copying a password should take under 3 seconds from app open.
- **Low cognitive load:** Minimal decisions required; sensible defaults everywhere.

### 4.2 Layout
- **Main view:** Search bar at top, scrollable list of records below (name + username shown, password hidden)
- **Record detail view:** Full record fields, reveal/copy buttons for sensitive fields
- **Create/Edit view:** Simple form, single column, clearly labeled fields
- **Vault lock screen:** Minimal — just a master password input

### 4.3 Interaction Design
- Search is instant (filter-as-you-type, no submit required)
- Password reveal requires an explicit click (never shown by default in list view)
- Destructive actions (delete, permanent delete) require confirmation dialogs
- Auto-lock triggers after inactivity (configurable, default 5 minutes)
- Keyboard-accessible: all actions reachable without mouse

### 4.4 Visual Style
- Clean, minimal aesthetic — neutral color palette
- Dark mode and light mode support
- Monospace font for passwords
- No animations that slow down interaction

---

## 5. Tech Stack Suggestion

### Option A: Desktop App (Recommended for personal use)
| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Tauri (Rust + WebView) | Lightweight native app, small binary, Rust backend for crypto |
| Frontend | React + TypeScript | Familiar, good component ecosystem |
| Styling | Tailwind CSS | Fast to build, consistent utility-first |
| Storage | SQLite (via Tauri/Rust) | Local file, reliable, queryable |
| Encryption | AES-256-GCM via `ring` (Rust) | Audited, fast, industry standard |
| Key derivation | Argon2id | Best-in-class for password hashing |

### Option B: CLI App (Simplest possible)
| Layer | Choice | Reason |
|-------|--------|--------|
| Language | Rust | Performance, safety, single binary |
| Storage | Encrypted JSON or SQLite | Simple local file |
| Encryption | AES-256-GCM + Argon2id | Same as above |

### Option C: Web App (Local server)
| Layer | Choice | Reason |
|-------|--------|--------|
| Backend | Node.js / Hono or Go | Fast to develop |
| Frontend | React + TypeScript | Same as Option A |
| Storage | SQLite | Local only, not exposed externally |
| Encryption | libsodium / Web Crypto API | Well-audited |

### Option D: Desktop App with Go Backend
| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Wails v2 (Go + WebView) | Native desktop app with Go backend, similar to Tauri but Go-based |
| Frontend | React + TypeScript | Same as Option A |
| Styling | Tailwind CSS | Same as Option A |
| Storage | SQLite (via `modernc.org/sqlite`) | Local file, no CGo dependency |
| Encryption | AES-256-GCM via Go `crypto/aes` + `crypto/cipher` | Standard library, audited |
| Key derivation | Argon2id via `golang.org/x/crypto/argon2` | Same security profile as Option A |

**Recommendation:** Option A (Tauri) for the best balance of usability and security. **Option D (Wails + Go) is recommended if Go is your preferred backend language** — it provides the same security guarantees with a more familiar development experience.

---

## 6. Security & Performance Requirements

### 6.1 Security

| Requirement | Detail |
|------------|--------|
| Encryption at rest | All vault data encrypted with AES-256-GCM; plaintext never written to disk |
| Key derivation | Master password hashed with Argon2id (min: m=64MB, t=3, p=4) |
| Memory safety | Sensitive values (master password, decrypted passwords) zeroed from memory after use |
| Vault lock | App locks vault after inactivity timeout; requires re-entry of master password |
| No network calls | App must not make any outbound network requests (local-only) |
| Clipboard hygiene | Clipboard cleared automatically after timeout (default 30s) |
| No master password storage | Master password is never persisted; only its derived key is used in-session |
| Backup files | Any exported backup must also be encrypted |

### 6.2 Performance

| Requirement | Target |
|------------|--------|
| App launch to usable | < 1 second |
| Search response time | < 100ms for up to 1,000 records |
| Record save/load | < 200ms |
| Password generation | Instant (< 50ms) |
| Vault unlock (decryption) | < 500ms |
| Memory footprint | < 100MB resident |
