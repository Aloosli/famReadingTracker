# 📚 Family Reading Tracker

[![CI](https://github.com/Aloosli/famReadingTracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Aloosli/famReadingTracker/actions/workflows/ci.yml)

A cozy, self-hosted reading dashboard for the whole family. Everyone gets their own
shelf, adds books by scanning a barcode or searching, tracks their progress, and
quietly unlocks little surprise achievements along the way — all on a device in your
own home, with no accounts, no passwords, and nothing sent to the cloud.

Built for iPads on the kitchen counter, but it runs anywhere Node does.

> **Why it exists:** to make reading feel like a shared, celebrated part of family life —
> warm, low-pressure, and never a leaderboard. Kids pick their own name, avatar and
> colour; progress is their own; and the rewards are hidden surprises, never a comparison
> between siblings.

---

## Screenshots

<!--
  Add screenshots here. Capture them on a device where emoji render (iPad or Mac) so the
  avatars and patches look right, then save them into docs/screenshots/ with these names
  and uncomment the images below. See docs/screenshots/README.md for the shot list.
-->

<!-- ![Who's reading? — the profile picker](docs/screenshots/profile-select.png) -->
<!-- ![A reader's home shelf with progress bars](docs/screenshots/home-shelf.png) -->
<!-- ![Adding a book by search](docs/screenshots/add-book.png) -->
<!-- ![The reading yearbook](docs/screenshots/yearbook.png) -->

_Screenshots coming — see `docs/screenshots/README.md` for the shot list._

---

## Features

**For each reader**
- 🧑‍🤝‍🧑 **Netflix-style profile picker** — tap your shelf to settle in. No passwords; the
  device remembers who you are.
- 📷 **Add books three ways** — scan a barcode with the camera, search Google Books, or
  enter a book by hand.
- 📊 **Progress tracking** with a friendly energy bar — log a page or a percentage, or
  just check in for the day to keep a streak alive.
- 🏅 **Hidden surprise titles & patches** — earn cozy achievements (including seasonal
  ones and personal bests) that pop up as a celebration. Triggers are hidden and never
  compare readers to each other.
- 😍 **Reactions & shelves** — mark finished books loved / liked / meh, keep an "Up Next"
  wishlist, set a book aside, and browse your finished shelf.
- 📖 **Reading yearbook** — a warm, wrapped-style recap of everything you read this year.
- 👨‍👩‍👧‍👦 **Family shelf** — see what everyone's reading right now.

**For the household**
- 🪄 **First-run setup wizard** — a fresh install walks you through creating your readers.
- ✏️ **Editable profiles** — anyone can rename themselves and pick a new avatar & colour.
- 👋 **Retire a reader** — remove someone who's moved on, with a clear confirmation.
- 💾 **Data & backup** — download a restore-ready copy of the whole database or a readable
  JSON export, any time. Your data is yours.
- 🌙 **Dark mode** with a toggle, and a warm parchment aesthetic in both themes.

---

## Quick start

**Prerequisites**
- [Node.js](https://nodejs.org) 20 or newer (native `better-sqlite3` bindings install
  automatically; most platforms use a prebuilt binary).

**Install & run**

```sh
# 1. Install dependencies
npm install

# 2. (Optional) add a Google Books API key — see Configuration below
cp .env.example .env

# 3. Start the dev server
npm run dev
```

Open the URL it prints (default <http://localhost:5173>). The first visit sends you to the
setup wizard to create your family — the database is created automatically on first run.

---

## Configuration

Configuration is via a `.env` file in the project root (copy `.env.example` to start).
Everything is optional.

| Variable                | Default                      | What it does                                                                 |
| ----------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| `GOOGLE_BOOKS_API_KEY`  | _(none)_                     | Book search & barcode lookup work without one, but a free key gives higher rate limits and more reliable results. Get one from the [Google Cloud Console](https://console.cloud.google.com/) (enable the Books API). |
| `DATABASE_PATH`         | `data/reading-tracker.db`    | Where the SQLite database lives. Point it at a persistent volume for deployments. |

`.env` is gitignored, so your key never gets committed.

---

## Data & backup

- All data lives in a single **SQLite** file at `data/reading-tracker.db` (created on first
  run, gitignored, uses WAL mode).
- The schema is applied and migrated automatically at startup — there's no separate
  migration step to run.
- In the app, open **Manage readers → Data & backup** to download either:
  - a **full `.db` backup** (restore-ready — drop it back in place of the database file), or
  - a **readable JSON export** of every reader, book, session and patch.
- Prefer the command line? Just copy `data/reading-tracker.db` while the app is stopped
  (or use the in-app `.db` download, which checkpoints the WAL so the copy is current).

> ⚠️ Avoid editing the database file directly while the dev server is running — the WAL
> means changes made by a second connection may not stick. Make changes through the app.

---

## Production deployment

The project uses [`adapter-node`](https://svelte.dev/docs/kit/adapter-node), so a build
is a plain Node server.

```sh
npm run build      # outputs to ./build
node build         # serves the app (honours PORT, default 3000)
```

Set `DATABASE_PATH` to a location on a persistent volume, and pass your `GOOGLE_BOOKS_API_KEY`
as an environment variable.

**HTTPS & the camera:** browsers only allow camera access (for barcode scanning) on
`localhost` or over **HTTPS**. To scan from an iPad on your home network, put the app
behind a reverse proxy with a TLS certificate (e.g. Caddy, or nginx + a local CA). Over
plain `http://` to an IP address, search and manual entry still work — only the scanner
is gated.

---

## Tech stack

- **[SvelteKit 2](https://svelte.dev/docs/kit)** + **[Svelte 5](https://svelte.dev)** (runes) and **TypeScript**
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** for a fast, embedded, zero-config database
- **[@zxing](https://github.com/zxing-js/library)** for in-browser barcode scanning
- **[Google Books API](https://developers.google.com/books)** for book metadata & covers
- **[adapter-node](https://svelte.dev/docs/kit/adapter-node)** for a self-contained Node deployment

Config note: this project keeps its SvelteKit options (runes + adapter) inside
`vite.config.ts`, so there's no separate `svelte.config.js`.

---

## Project structure

```
src/
├─ routes/
│  ├─ +page.svelte        # profile picker + manage readers (add / retire / backup)
│  ├─ setup/              # first-run family setup wizard
│  ├─ home/               # a reader's shelf: progress, streaks, finished books, editor
│  ├─ add/                # add a book: scan, search, or manual
│  ├─ family/             # what everyone's reading now
│  ├─ year/               # the reading yearbook
│  ├─ data/               # data & backup page + export endpoint
│  └─ api/books/search/   # Google Books search proxy
└─ lib/
   ├─ server/db/          # schema, queries, backup builder
   └─ server/titles/      # the hidden surprise-title engine (config + evaluation)
```

---

## Privacy

No accounts, no telemetry, no third-party analytics. The only outbound request is to the
Google Books API when you search for or scan a book. Everything else stays on your device.

---

## License

[MIT](LICENSE) — use it, fork it, run it for your own family.
