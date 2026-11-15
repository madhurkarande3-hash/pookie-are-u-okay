# Pookie — A little care, a lot of love

An AI companion and care app for older adults, built for independence and dignity. It offers:

- a friendly companion to talk to, by voice or text, in English and Hindi
- medicine, appointment and check-in reminders that never treat silence as a missed dose or an emergency
- a Care Circle of family and caregivers who see only what the elder allows
- **LifeBook**, a personal memory library (people, stories, places, photos, voice memories) that helps people living with Alzheimer's, without ever inventing a memory

Built with Next.js 14, React 18, strict TypeScript and Tailwind CSS. The backend uses Firebase Authentication, Cloud Firestore, Cloud Storage, Cloud Functions (v2), Cloud Scheduler, Firebase Cloud Messaging, App Check, Google Cloud Text-to-Speech, the Gemini API and the Gemini Live API.

| | |
|---|---|
| **Judges** | [docs/DEMO.md](docs/DEMO.md): a 6-minute walkthrough |
| **Architecture** | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): data model, APIs, how each rule is enforced |
| **Security & privacy** | [docs/SECURITY.md](docs/SECURITY.md): threat model, controls, DPDP Act review (no compliance claim) |
| **Status** | [docs/AUDIT.md](docs/AUDIT.md): what is done, verified, and still open |
| **History** | [CHANGELOG.md](CHANGELOG.md) |

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

### Local emulators

```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true   # in .env.local
npm run emulators                         # auth 9099 · firestore 8080 · functions 5001 · storage 9199
```

### Restoring a backup

```bash
gcloud firestore import gs://<BACKUP_BUCKET>/<YYYY-MM-DD>
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run build:single` | One self-contained HTML file of the Demo app |
| `npm run typecheck` / `lint` | Strict TypeScript (`noUncheckedIndexedAccess`) / ESLint |
| `npm test` | 109 unit tests (Vitest) |
| `npm run test:rules` | Firestore security-rules tests on the emulator (Java 11+) |
| `npm run test:e2e` | 22 Playwright end-to-end and axe accessibility checks (phone + desktop) |
| `npm run test:all` | Typecheck, unit tests and rules tests |
| `npm run deploy` | Deploy Firestore rules/indexes and functions |

CI (`.github/workflows/ci.yml`) runs all of these on every push.

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

## Known limitations

- **Not yet run against live services.** Gemini, Gemini Live, Cloud TTS, FCM, Scheduler and email are implemented and type-checked against the real SDKs, but they have not been run against real credentials. The build environment has no project. Run `npm run test:rules` and the smoke checks in [docs/DEMO.md](docs/DEMO.md) after the first deploy.
- **Gemini Live is a preview.** It depends on the live model name in `LIVE_MODEL` and the browser's audio support. If it can't connect, the app falls back to the standard voice mode.
- **Voice in Demo Mode** uses the device's built-in voices, so Kaka may sound like a pitched-down female voice on phones that have only one Hindi voice. The real-server mode uses Cloud TTS voices.
- **Push needs extra setup.** Web push needs a VAPID key and a supported browser. On iPhone it needs iOS 16.4+ with Pookie added to the Home Screen.
- **Google Calendar sync** for appointments is not built.
- **No formal clinical or legal review.** Pookie is a companion, not a medical device. The DPDP review in docs/SECURITY.md is a self-assessment, not a compliance claim.

Pookie does not diagnose or treat any condition, including Alzheimer's. In an emergency, call your local emergency number (112 in India).
