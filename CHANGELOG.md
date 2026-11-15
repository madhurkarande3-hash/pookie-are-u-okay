# Changelog

## Reminder history, calendar files and plainer wording

- Reminder history (`/reminders`, linked from Settings): reminders this device showed, plus the server's
  `notifications` records when Pookie runs with its server (`Repository.listReminderHistory`, `src/lib/reminderLog.ts`).
- "Add to my calendar" on upcoming appointments: an RFC 5545 `.ics` file with a 1-hour alarm (`src/lib/domain/ics.ts`).
- Wording: the "Demo Mode" label is gone from the app. Notices still say plainly that data stays on the device,
  that replies are pre-written rather than AI, that no email is sent, and that the sample care-team login is not real security.
- `robots.txt` (private screens not crawled), `sitemap.xml`, web app manifest, Open Graph metadata and `/llms.txt`.

## Alzheimer's care pack, health hub and multi-provider AI

- Simple Mode (`/simple`), reminiscence (`/remember`), "Where am I?", family voice reminders on medicines,
  consented safe area (app-open only), "Today with …" family digest, supported/guardian decision-making.
- Care-team login and multi-patient dashboard (`/admin`, `careTeam` claim, `careTeamPatients` callable,
  `functions/scripts/grant-care-team.mjs`); clearly labelled demo login in Demo Mode.
- Health hub (`/health`) and Emergency screen (`/emergency`); stored at `elders/{id}/private/medical`.
- AI provider manager: Adaption Labs → Gemini → OpenAI → Groq → OpenRouter, configurable, timeouts,
  bounded retries, error categories, per-provider LifeBook allow-list, admin-only diagnostics API.


## M1 — Deploy and safety net
Fictional sample data (one tap) and a seed script for demo accounts; Playwright end-to-end and axe accessibility suite (22 checks); GitHub Actions CI (typecheck, lint, unit, rules emulator, e2e, builds); Firebase App Hosting config; documented environment variables.

## M6 — LifeBook complete
Places, Photos (EXIF stripped) and Voice Memories; dates, relationships and links to people; search; per-memory sharing (private by default); correction history; conflict detection that asks instead of guessing (also told to the AI); orientation card on Home.

## M4 / M5 / M7 — Reminders, voices, live AI, hardening
Server reminder sweep (timezone, quiet hours, kinds, duplicate-proof ids, FCM push and email, retries, honest delivery status); Cloud Text-to-Speech companion voices; Gemini Live real-time voice (preview) with single-use tokens; AI rate limits and App Check; conversation metadata without words; audit-log triggers; nightly backups; invitation email.

## M3 — Core care workflows
Medicine frequency, dates and history; appointment preparation, status and per-visit visibility; spoken check-in notes, history and follow-up check-ins; "I'd like some help" with acknowledgement; Care Circle activity on Home; call/text the elder; invitations can be declined.

## M2 — Look, companion, accounts
Theme separated from companion (Pookie, Granny Pookie, Kaka Pookie); Hindi gender-aware companion speech; password reset; profile editing; reminder preferences (timezone, quiet hours, kinds, channels); privacy page; account deletion; Devanagari font; wide-screen layout.

## Personas
Granny Pookie and Kaka Pookie companion personalities shared by the Gemini prompt and Demo replies; device voice picking.

## MVP
13 screens, English/Hindi, two themes, medicines with Taken/Missed/Unconfirmed, check-ins, appointments, LifeBook with family suggestions, Care Circle with per-person permissions, Gemini companion function, Firestore rules, family notices, Demo Mode.
