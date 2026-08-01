# Stage 0 — Auth and tenant isolation

Living doc. What has to be true before a second family's data lives in this database, what's
done, and what's left.

Context: the app was built for one family on a home network. A friend asked to use it, which
raises the question of hosting it for other families. Before *any* of that — before accounts,
billing or polish — the data of two families has to be incapable of touching. This doc is that
work. Everything else (Stripe, email, onboarding) is deliberately out of scope until two
families have actually used the app for eight weeks.

Audit date: 2026-08-01. Covers all modules in `src/lib/server/db/`, all route servers, and
`hooks.server.ts`.

---

## The shape of the problem

The db layer was in better shape than expected — almost every function already takes a
`householdId` or a `userId` and filters on it. The leak is one level up.

**There are two sources of truth for "which family is this?"**

1. `hooks.server.ts` sets `locals.householdId` from `getDefaultHouseholdId()`.
2. Routes ignore that, call `getUserById(Number(cookies.get('profile_id')))` — which is **not**
   household-scoped — and then use `user.household_id`.

Today these always agree, because there is exactly one household. The moment there are two they
diverge, and the app is already written to mix them: `add/+page.server.ts` creates the book in
`locals.householdId` but attaches the entry to `user.household_id`.

So the fix is not "scope the queries" — mostly they are scoped. It is **collapse tenancy to one
source of truth, and make identity unforgeable.**

---

## What protects production today: Cloudflare Access

The app runs on Unraid behind a Cloudflare Tunnel at `reading.lizrdwizrd.uk`, with a **Cloudflare
Access** policy in front. Verified 2026-08-01: a request carrying no Access cookie is redirected to
the Cloudflare Access login, so nothing behind that hostname is reachable anonymously.

This matters for reading the findings below. S1 and S2 were severe — an open `GET` that emitted the
whole database and an open `POST` that wiped it — but **they were never publicly exploitable**, because
Access has been in front of them the entire time.

**Access is a perimeter, not a boundary.** It answers "may this person reach the app at all?", not
"whose data may they see once inside?". Everyone who passes the policy gets everything behind it.
Today the policy is one email — the owner's — so the perimeter and the boundary happen to coincide,
and the app's lack of tenant isolation costs nothing.

They stop coinciding the instant a second email is added to that policy, which is the obvious first
move when giving another family an account. Pre-fix, that single change would have put a second
family one URL away from downloading everyone's data.

> **Ordering rule: Access first, then app-level isolation, then invite anyone.**
> Never add an email to the Access policy as a way of onboarding a family. Access is not a
> substitute for the work in this document, and no finding below should be downgraded because
> "Access is in front of it".

---

## Findings

Severity order. ✅ = fixed, ⬜ = outstanding.

### ✅ S1 — `/data/export` handed the entire database to anyone

`src/routes/data/export/+server.ts` had no profile check, no `locals`, no auth of any kind.
`?format=db` returned the raw SQLite file; `?format=json` returned `SELECT * FROM <every table>`.
A public URL that emitted every household's data, including every child's name.

**Fixed:** the endpoint now requires a profile via `requireProfile`, and the JSON export is built
per-household through `buildBackup(householdId)`. The raw `.db` download is kept (it is a genuinely
better backup for a single-family install) but *refuses to serve when more than one household
exists* — it cannot be filtered, so it is all-or-nothing, and it turns itself off automatically
rather than relying on anyone remembering.

### ✅ S2 — `/data` restore wiped the entire database, unauthenticated

`restoreBackup()` deleted every row in every table before re-inserting. Any visitor could destroy
every family's data with one POST.

**Fixed:** `restoreBackup(householdId, backup)` clears and replaces only the requesting household's
rows, via the same scope rules the export uses. Verified: restoring family 1's backup with family 2
present leaves every one of family 2's rows untouched.

### ✅ S9 — `getBackupSummary()` counted every household's rows

**Fixed:** now takes a `householdId`.

### ✅ (bonus) The JSON backup was silently lossy

`BACKUP_TABLES` omitted `households`, `freeze_bank`, `streak_freeze_days` and `family_goals`.
A backup → fresh-machine restore therefore lost **every banked streak freeze and the family goal**,
with no error. Found while working out how each table scopes to a household.

**Fixed:** format bumped to v2 with those four tables included. v1 files still restore — only the
original seven tables are required by `isValidBackup`, and `normalizeBackup` fills the rest with
empty arrays, which is exactly what a v1 restore did before, minus the silence.

### ⬜ S3 — Identity is a plaintext user id in a cookie

`profile_id=7` means "I am user 7". No signature, no secret, no session. On the family tablet this
is correct design — picking a profile is a convenience, not a login. On the open internet it is
account takeover by typing a number. **This cannot be patched; it has to be replaced.** See the
auth design below.

`requireProfile` now at least guarantees the resulting reader is inside the request's household,
so a forged id can't steer a handler across tenants. That is a consistency check, not a boundary.
It becomes a real boundary once `locals.householdId` comes from a signed session.

### ⬜ S4 — `getUserById(id)` is not household-scoped

`src/lib/server/db/users.ts`. The entry point of every authenticated route — 25 call sites across
four route files. `getUserInHousehold(householdId, id)` now exists beside it and is what
`requireProfile` uses; folding the remaining 25 sites onto it is the next step.

### ⬜ S5 — `retireReader` deletes any reader in any household

`src/routes/+page.server.ts`. Validates that the user *exists*, not that they're yours.
`deleteUser()` cascades to their entries, sessions, freezes, wishlist and titles.

### ⬜ S6 — `updateBookPageCount(bookId, …)` is unscoped

`books.ts`, called from `home/+page.server.ts` with a `bookId` straight off the form.

### ⬜ S7 — Book ids from forms are never checked against the household

`home/+page.server.ts` — log progress, check in, page count. A foreign `bookId` writes a
`reading_sessions` row for (your user, their book); every shelf query joins `books`, so their
book's title, author and cover then render on your page. A cross-tenant read via a write.

### ⬜ S8 — `getDisplayTitlesForAllUsers()` scans all households

`titles.ts`. Currently benign — the result is a Map keyed by `user_id`, only looked up for users
already fetched by household — but it is a global scan one refactor away from leaking, and it is on
the profile picker.

---

## What was already correct

Worth recording, because it is most of the code and it is why this is a contained job:

- `entries.ts` — every mutator takes `(entryId, userId)` and filters on both. Family views take
  `householdId` and join `users u ON u.household_id = ?`.
- `sessions.ts` — `updateSession` / `deleteSession` filter on `user_id`, return `changes > 0`.
- `wishlist.ts` — all four functions owner-scoped, including the by-id delete.
- `goals.ts` — household-scoped throughout; `markGoalAchieved` is only called with a goal already
  fetched by household.
- `books.ts` finders — all three take `householdId` and filter on it.
- `streaks.ts` — per-user throughout.

These need no change. Once `userId` is trustworthy, they are safe.

---

## Auth design (not yet built)

**Two layers, matching the actual mental model:** a grown-up's *account* owns a *household*;
readers are profiles inside it. Kids never get logins.

That last part is not just simpler — it is the whole children's-data posture. No child credential,
no child email, no child-facing account recovery. First names and page counts, entered by a parent,
under a parent's account. Keep it that way.

```sql
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,              -- sha256 of the cookie token, never the token itself
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_auth_sessions_account ON auth_sessions(account_id);
```

- **Token**: 32 random bytes from `crypto.randomBytes`, base64url. The cookie holds the token; the
  table holds its SHA-256, so a database read doesn't yield live sessions.
- **Password hashing**: `node:crypto` `scrypt` — built in, zero new dependencies. argon2id is
  stronger but pulls a native module; not worth it at this scale.
- **Cookie**: `session`, `httpOnly`, `secure`, `sameSite: 'lax'`, rolling 1-year expiry.
- **Rate limiting**: per email and per IP on login. An in-memory token bucket is fine on one node.

It plugs into exactly one place, as `hooks.server.ts` already promises:

```ts
export const handle: Handle = async ({ event, resolve }) => {
  const account = resolveAccountFromSession(event.cookies);
  event.locals.account = account;
  event.locals.householdId = account?.household_id ?? null;
  return resolve(event);
};
```

Make `locals.householdId` nullable when this lands — that is what makes TypeScript flag every route
that assumed a household exists.

**The refactor that does the audit for you:** change `getUserById(id)` to require a household, then
let the compiler find every call site. After that, `user.household_id` should never be read again —
`locals.householdId` becomes the only source of truth.

---

## Remaining sequence

| # | Work | Est. |
|---|------|------|
| ✅ 1 | Close the export/restore holes; household-scope backup; fix the lossy format | done |
| 2 | `accounts` + `auth_sessions`, scrypt, signup/login/logout, `hooks.server.ts` wiring | 1–2 weekends |
| 3 | Fold all 25 `getUserById` sites onto `requireProfile` / `getUserInHousehold` (S4) | 1 weekend |
| 4 | `requireBook` guard; scope `retireReader`, `updateBookPageCount`, `getDisplayTitlesForAllUsers` (S5–S8) | 1 evening |
| 5 | Cross-tenant test suite | 1 weekend |

### The test suite is the deliverable that lasts

`vitest` is wired up, but note the existing convention: `db/index.ts` opens a real SQLite file at
import time, so db-touching modules aren't unit-testable as-is. That is why pure logic lives in
`backup-format.ts` and is tested there, while `backup.ts` stays a thin shell over it. The scoping
rules (`HOUSEHOLD_SCOPE`, `scopedSelect`, `scopedDelete`) were deliberately written as pure data and
string builders so the isolation logic *is* testable without a database — including a test asserting
that export and restore agree on what "this family's rows" means.

For step 5, the real prize is a fixture with two households and an assertion, for every route, that
household A cannot read, write or delete anything of household B's. Until then, `npm test` covers
the format layer only.

Without that suite, isolation decays the first time a page is added in a hurry — and unlike a normal
regression, you don't find out until a stranger sees your kids' names.

---

## How this was verified

Not just types and unit tests. Production was never touched: the family's real data lives on the
Unraid box, while `data/reading-tracker.db` in the repo is a local dev throwaway. A *copy* of that
dev file was seeded with a second household (reader, book, entry, session, goal, banked freeze), a
dev server run against the copy, and:

| Check | Result |
|---|---|
| `GET /data/export?format=json` with no cookie | 302 → `/` (was: whole database) |
| `GET /data/export?format=db` with 2 households | 403 with an explanatory message |
| `GET /data/export?format=json` with `profile_id=3` (a reader in the *other* household) | 302 → `/` |
| `GET /data/export?format=json` as household 1 | 200, zero occurrences of the other family's data |
| `POST /data?/restore` of household 1's backup | household 2's users, books, entries, sessions, goals and freezes all still present |
| `POST /data?/restore` of a v1-shaped file | accepted, no data loss |
