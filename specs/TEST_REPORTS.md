# TEST_REPORTS.md — passwd Test Run History

---

## Run #1 — 2026-03-08 12:27

**Trigger:** Manual test run (no code change — baseline report)
**Branch:** main
**Commit:** `5b0d7ec` — Update app icon with transparent background and convert to ICO

---

### Backend — `go test ./backend/... -v`

| Package | Result | Duration |
|---------|--------|----------|
| `github.com/oraclepxx/passwd/backend` | ✅ PASS | 1.297s |
| `github.com/oraclepxx/passwd/backend/models` | — (no test files) | — |
| `github.com/oraclepxx/passwd/backend/vault` | ✅ PASS | 1.869s |

**Pass: 47 / 47 — Fail: 0 — Skip: 0**

---

### Frontend Unit — `cd frontend && npm test`

| Test File | Tests | Result |
|-----------|-------|--------|
| `src/__tests__/useClipboard.test.ts` | 5 | ✅ PASS |
| `src/__tests__/ConfirmDialog.test.tsx` | 5 | ✅ PASS |
| `src/__tests__/RecordCard.test.tsx` | 9 | ✅ PASS |
| `src/__tests__/PasswordField.test.tsx` | 8 | ✅ PASS |
| `src/__tests__/FormView.test.tsx` | 11 | ✅ PASS |

**Pass: 38 / 38 — Fail: 0 — Skip: 0**

**Warnings (non-blocking):**
- `FormView.test.tsx` — 7× React `act()` warning on async state updates inside `RecordGet` mock resolution. Tests pass; warnings indicate the async update in `FormView`'s `useEffect` (fetching record for edit mode) is not wrapped in `act()` inside the test. No functional impact — consider wrapping `waitFor` calls in future test maintenance.

---

### Frontend Journeys — `src/__tests__/journeys/`

**Status: Not yet implemented.** Test files do not exist.
57 planned test cases across 11 journey files are pending authoring.

---

### Summary

| Suite | Pass | Fail | Skip | Not Implemented |
|-------|------|------|------|-----------------|
| Backend | 47 | 0 | 0 | — |
| Frontend Unit | 38 | 0 | 0 | — |
| Frontend Journeys | — | — | — | 57 |
| **Total** | **85** | **0** | **0** | **57** |

**Overall result: ✅ PASS** (all implemented tests pass)

---

### Failed / Skipped Tests

None.

---
