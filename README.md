# Cubalyze

**An offline-first speedcubing platform.** Time your solves with a smart cube, find out exactly which phase is costing you seconds, and drill the cases you're actually missing.

**[Open Cubalyze →](https://cubeforge-phi.vercel.app/)**

No account. No sign-up. No internet required. Your solves stay on your device.

---

## What it does

Cubalyze brings together the five things speedcubers usually juggle between
separate apps, and makes them talk to each other.

### Timer

WCA-format timing with a 15-second inspection, `+2` and DNF penalties, and
scramble generation for 2×2 and 3×3. Timer with the spacebar, or let it time
itself — see [hardware](#hardware-support) below.

### Insights

Every solve is broken down as you finish it:

- **Phase splits** — cross, F2L, OLL, PLL, each with its own TPS
- **Turn count** — how much of your time is moves versus recognition
- **Rotation economy** — how often you have to reorient, and what it costs
- **Progression** — your rolling averages, personal bests, and the trend over
  weeks and months

The point is not a prettier chart. It is answering *which phase is holding me
back*, and then doing something about it.

### 3D replay

Scrub through any solve move by move in a 3D cube. See the rotation, see the
recognition pause, see the mistake. This is where a bad habit usually becomes
obvious.

### Algorithm database

5,212 algorithms across 494 cases — F2L, OLL, PLL, COLL, WV, ZB, Roux and more.
Searchable, with case diagrams, and sorted by move count, difficulty and slot.
Every algorithm is verified by a test to actually solve its case; ones that
don't are never shipped.

### Training

Spaced repetition over the same case database, so you review what you're about
to forget instead of what you already know. Drills for cross, F2L and full
review queues, plus a skill tree that shows where you are for each method.

### Reconstructions

14,565 real solves from the reconstruction community, with scrambles, phase
annotations and technique notes. Filter by method, event or competition. This
is the fastest way to see what a solution *should* look like next to your own.

### Skill radar

Your profile across six axes — TPS, lookahead, economy, ergonomics, recognition
and consistency — benchmarked against competitive times, so you know which
weakness to attack first.

---

## Hardware support

Timing does not have to be manual.

- **GAN smart cubes** — 356i and the Gen2/Gen3 series, over Web Bluetooth.
  Solves are detected and timed automatically, with clock-drift correction so
  the timer stays honest over a long session.
- **StackMat** — decode the audio from a StackMat timer through an
  `AudioWorklet`. A USB sound card gives the best results.

Both fall back to the spacebar whenever they're not connected, so you can start
solving immediately and not think about it.

---

## Built with

<img src="https://skillicons.dev/icons?i=ts,react,vite,tauri,rust,tailwind,supabase,sqlite,threejs,pnpm&perline=10" alt="TypeScript, React, Vite, Tauri, Rust, Tailwind, Supabase, SQLite, three.js, pnpm" />

| | |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS, Radix UI, Framer Motion, Recharts |
| **3D** | three.js, rendered in a Web Worker over WebGL2 |
| **Desktop** | Tauri 2 / Rust, with native Bluetooth and a bundled SQLite driver |
| **Storage** | SQLite compiled to WebAssembly on OPFS, plus IndexedDB |
| **Backend** *(optional)* | Supabase — Postgres with row-level security, Edge Functions, OAuth PKCE |
| **Hardware** | Web Bluetooth for GAN cubes, AudioWorklet for StackMat |
| **Tooling** | Vite, Turborepo, pnpm workspaces, Vitest, fast-check, GitHub Actions |

The icon row is rendered by [skillicons.dev](https://skillicons.dev/); the table
below is the source of truth if it ever fails to load, and it lists a few things
that have no icon there.

---

## Getting started

### Web (recommended)

Open **[cubalyze](https://cubeforge-phi.vercel.app/)**. It is an installable
PWA — add it to your home screen or dock and it behaves like a native app. No
build, no install, works on desktop and mobile.

### Desktop

A Tauri build wraps the same interface with native Bluetooth and a local SQLite
driver, so the app starts instantly and does not depend on a browser database.

### From source

```bash
git clone https://github.com/Doritozz05/Cubalyze.git
cd Cubalyze
pnpm install
pnpm dev
```

Node 18+ and pnpm 9+ are the only prerequisites. To run everything against
your own Supabase project, copy `apps/web/.env.example` to `apps/web/.env` and
fill in the two values — otherwise the app runs entirely on your device.

---

## Your data

Solves live in a SQLite database in your browser, on your device. They are
exportable at any time in CSV or JSON, and importable from **csTimer** and
**CubeTimer** exports.

Cloud accounts and cross-device sync are available but entirely optional. When
you link one, your data is scoped to you at the database level: every table
carries a row-level security policy keyed to your account, and nothing is
readable by anyone else. You can delete your account and your data from inside
the app.

---

## Data sources and credits

Cubalyze stands on other people's work, and tries to say so. Every algorithm and
every reconstruction links back to where it came from.

| Source | Used for |
|---|---|
| [SpeedCubeDB](https://speedcubedb.com) | Core algorithm sets, community votes, verification status |
| [BirdF2L](https://github.com/andydude/birdf2l) | F2L case taxonomy and advanced cases |
| [CubeRoot](https://cuberoot.me) · [reco.nz](https://reco.nz) | Reconstruction dataset (14,565 solves) |
| [WCA](https://www.worldcubeassociation.org) | Competition names and result metadata |
| [min2phase.js](https://github.com/cs0x7f/min2phase.js) | Two-phase solving and scramble generation |
| [gan-web-bluetooth](https://github.com/afedotov/gan-web-bluetooth) | Reference for the GAN BLE protocol |

[`DATA_SOURCES.md`](DATA_SOURCES.md) has the full provenance record, including
licensing notes. The in-app **Credits** panel lists everything at runtime.

---

## Documentation

| | |
|---|---|
| [Product requirements](docs/00-product/) | What the app is for and who it serves |
| [Roadmap](docs/01-roadmap/) | What comes next |
| [Architecture](docs/02-architecture/) | How it is put together |
| [User documentation](docs/16-user/) | Guides and manuals |
| [Contributing](docs/15-contributing/) | How to help |
| [Security policy](SECURITY.md) | Reporting a vulnerability |

---

## Contributing

Contributions are welcome — bug reports, translations, algorithms, and code all
count. The project is governed by a written pipeline (idea → RFC → ADR → TDD →
code), and [`docs/14-ai/AGENTS.md`](docs/14-ai/AGENTS.md) is the operating
manual any contributor should read first.

Please read the [contributing guide](docs/15-contributing/CONTRIBUTING.md) before
opening a pull request.

---

## License

MIT — see [`LICENSE`](LICENSE). Third-party components keep their own licences;
they are enumerated in [`DATA_SOURCES.md`](DATA_SOURCES.md).

Javier Vivo Samaniego · <cubalyze@gmail.com>
