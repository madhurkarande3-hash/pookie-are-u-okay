<div align="center">

<img src="src/app/icon.svg" alt="Pookie logo" width="96" height="96" />

# Pookie: are u okay?

**A little care, a lot of love.** Pookie is an AI companion and care app for older adults, built for independence and dignity.

[![CI](https://github.com/madhurkarande3-hash/pookie-are-u-okay/actions/workflows/ci.yml/badge.svg)](https://github.com/madhurkarande3-hash/pookie-are-u-okay/actions/workflows/ci.yml)
![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%C2%B7%20Functions-FFCA28?logo=firebase&logoColor=black)
![Gemini](https://img.shields.io/badge/Gemini-API%20%2B%20Live-8E75B2?logo=googlegemini&logoColor=white)
![WCAG 2.1 AA](https://img.shields.io/badge/axe-WCAG%202.1%20AA-2E7D32)
![English · हिन्दी](https://img.shields.io/badge/i18n-English%20%C2%B7%20%E0%A4%B9%E0%A4%BF%E0%A4%A8%E0%A5%8D%E0%A4%A6%E0%A5%80-FF7A59)

[Try the demo](#try-it-in-one-minute-demo-mode-no-keys) · [6-minute walkthrough](docs/DEMO.md) · [Architecture](docs/ARCHITECTURE.md) · [Security & privacy](docs/SECURITY.md) · [Status](docs/AUDIT.md)

</div>

---

## What Pookie does

| | Feature | What it means for the elder |
|---|---|---|
| 💬 | **Companion** | A friendly companion to talk to by voice or text, in English and Hindi. Choose Pookie, Granny Pookie or Kaka Pookie. |
| 💊 | **Medicines & appointments** | Reminders that never treat silence as a missed dose. "Missed" is recorded only when the elder says so. |
| 🌤️ | **Check-ins** | Mood, sleep and energy. A missed check-in means "no response", never an emergency. |
| 👨‍👩‍👧 | **Care Circle** | Family and caregivers see only what the elder allows, person by person and item by item. Sharing can be paused at any time. |
| 📖 | **LifeBook** | A personal memory library (people, stories, places, photos, voice memories) that helps people living with Alzheimer's. Pookie never invents a memory. |
| 🆘 | **"I'd like some help"** | Help is sent only when the elder presses the button. |

## Principles

These rules are enforced in code, security rules and tests, not only in the UI:

- **The elder decides.** Family can propose; only the elder accepts, changes or pauses.
- **Private unless shared.** Each check-in, note, visit and memory is shared one at a time.
- **No guessing.** The AI uses only confirmed memories, cites them, asks when unsure and flags conflicting facts.
- **No diagnosis.** Pookie is a companion, not a medical device.
- **Discreet.** Lock-screen notifications never show medicine names or doctors.
- **Honest Demo Mode.** Scripted replies are labelled "scripted, not AI", and nothing is sent.

## Tech stack

| Layer | Built with |
|---|---|
| Web app | Next.js 14 (App Router), React 18, strict TypeScript, Tailwind CSS |
| Data & auth | Firebase Authentication, Cloud Firestore, Cloud Storage, App Check |
| Server | Cloud Functions v2 (`asia-south1`), Cloud Scheduler, Firebase Cloud Messaging |
| AI & voice | Gemini API, Gemini Live API, Google Cloud Text-to-Speech |
| Quality | Vitest, Firestore rules emulator tests, Playwright and axe, GitHub Actions |

---

## Try it in one minute (Demo Mode, no keys)

```bash
npm install
npm run dev            # http://localhost:3000
```

On the welcome screen, choose **Explore with sample data** to load Asha, a fictional elder, with her Care Circle. Or tap **Get started** to set up from scratch.

Demo Mode is honest about what it is:
- a banner on every screen says Demo Mode
- data stays in this browser
- companion replies are labelled "scripted, not AI"
- no email or push is sent or faked

The Care Circle screen has **Demo: view as …** buttons, so you can see exactly what each family member or caregiver sees. Demo Mode applies the same permission rules as the backend.

**One file to share:** `npm run build:single` builds the entire Demo app into `web-single/dist/index.html`, which runs anywhere, even straight from disk. A prebuilt copy is in [`demo/pookie-demo.html`](demo/pookie-demo.html). Inside sandboxed viewers the microphone and downloads may be blocked; typing works.

## Run it for real (Firebase + Gemini)

<details>
<summary><b>Full setup: Firebase project, secrets, deploy</b></summary>

1. **Create a Firebase project on the Blaze plan.** Enable Authentication (Email/Password, Google), Firestore, Storage and App Hosting. Enabling Cloud Functions also enables Cloud Scheduler. Then enable the **Cloud Text-to-Speech API** in Google Cloud.
2. **Web config:** `cp .env.example .env.local` and fill in the `NEXT_PUBLIC_FIREBASE_*` values. These are public by design; access is enforced by `firestore.rules` and `storage.rules`.
3. **Project:** `cp .firebaserc.example .firebaserc` and set your project id.
4. **Secrets (server only):**
   ```bash
   npx firebase functions:secrets:set GEMINI_API_KEY
   ```
5. **Function settings:** `cp functions/.env.example functions/.env` and set `APP_URL` and, optionally, `EMAIL_ENABLED`, `BACKUP_BUCKET` and `ENFORCE_APP_CHECK`.
6. **Deploy the backend:**
   ```bash
   npm --prefix functions install
   npx firebase deploy --only firestore,storage,functions
   ```
7. **Deploy the web app with Firebase App Hosting:** `npx firebase apphosting:backends:create`, then point it at this repo. `apphosting.yaml` lists every variable.
8. **Optional features:**
   - **Web push:** add `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (Cloud Messaging → Web configuration).
   - **App Check:** add a reCAPTCHA Enterprise key in `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY`, then set `ENFORCE_APP_CHECK=true`.
   - **Email:** install the **Trigger Email** extension and set `EMAIL_ENABLED=true`.
   - **Backups:** set `BACKUP_BUCKET` and give the functions' service account the "Cloud Datastore Import Export Admin" role.
9. **Demo accounts for judges (fictional):**
   ```bash
   cd functions && DEMO_PASSWORD='…' GCLOUD_PROJECT=<id> node scripts/seed-demo.mjs
   ```

Every function runs in `asia-south1`. Firestore triggers must be in the same region as the database, so change `REGION` in `functions/src/*` if yours differs.

**Local emulators**

```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true   # in .env.local
npm run emulators                         # auth 9099 · firestore 8080 · functions 5001 · storage 9199
```

**Restoring a backup**

```bash
gcloud firestore import gs://<BACKUP_BUCKET>/<YYYY-MM-DD>
```

</details>

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run build:single` | One self-contained HTML file of the Demo app |
| `npm run typecheck` / `lint` | Strict TypeScript (`noUncheckedIndexedAccess`) / ESLint |
| `npm test` | 112 unit tests (Vitest) |
| `npm run test:rules` | Firestore security-rules tests on the emulator (Java 11+) |
| `npm run test:e2e` | Playwright end-to-end and axe accessibility checks (phone + desktop) |
| `npm run test:all` | Typecheck, unit tests and rules tests |
| `npm run deploy` | Deploy Firestore rules/indexes and functions |

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs all of these on every push and pull request.

## Project structure

```
src/
  app/                    Next.js App Router pages
    page.tsx              Welcome (+ sample data in Demo Mode)
    privacy/              "What Pookie keeps, and who sees it"
    onboarding/           pookie (look + companion) · profile · circle · consent
    (app)/                home · companion · checkin · medications · appointments
                          lifebook · family · circle · settings
  components/             Feature components; components/ui = design-system primitives
  hooks/                  useAsyncData, usePolicy, useReminders, usePushReminders
  lib/
    domain/               Pure business logic: permissions, medication, schedule, lifebook, validation
    data/                 Repository interface; Demo (localStorage) + Firebase implementations; sample data
    ai/                   Companion client, scripted Demo replies, voices, Gemini Live client
    firebase/             Config, client (App Check), auth, messaging
    i18n/                 en.ts defines the keys; hi.ts must match (enforced by a test)
    theme/tokens.ts       Design tokens → CSS variables
  state/                  PrefsProvider (look, companion, language, text size, motion), SessionProvider
functions/
  src/index.ts            companionReply, speak, liveToken, notify*, deleteMyAccount
  src/reminders.ts        reminderSweep (Scheduler) + web push / email delivery
  src/audit.ts            Audit-log triggers
  src/backup.ts           nightlyBackup · src/invites.ts emailInvitation
  src/shared/             Pure modules shared with the web app (and unit-tested)
  scripts/seed-demo.mjs   Fictional demo accounts
web-single/               One-file Demo build (Vite) with hash routing
tests/                    Unit tests · tests/rules (emulator) · tests/e2e (Playwright)
firestore.rules · storage.rules · firestore.indexes.json · firebase.json · apphosting.yaml
```

Working on this repo with an AI coding agent? Start with [AGENTS.md](AGENTS.md).

## Known limitations

- **Not yet run against live services.** Gemini, Gemini Live, Cloud TTS, FCM, Scheduler and email are implemented and type-checked against the real SDKs, but they have not been run against real credentials. The build environment has no project. Run `npm run test:rules` and the smoke checks in [docs/DEMO.md](docs/DEMO.md) after the first deploy.
- **Gemini Live is a preview.** It depends on the live model name in `LIVE_MODEL` and the browser's audio support. If it can't connect, the app falls back to the standard voice mode.
- **Voice in Demo Mode** uses the device's built-in voices, so Kaka may sound like a pitched-down female voice on phones that have only one Hindi voice. The real-server mode uses Cloud TTS voices.
- **Push needs extra setup.** Web push needs a VAPID key and a supported browser. On iPhone it needs iOS 16.4+ with Pookie added to the Home Screen.
- **Google Calendar sync** for appointments is not built.
- **No formal clinical or legal review.** Pookie is a companion, not a medical device. The DPDP review in docs/SECURITY.md is a self-assessment, not a compliance claim.

> [!IMPORTANT]
> Pookie does not diagnose or treat any condition, including Alzheimer's. In an emergency, call your local emergency number (112 in India).
