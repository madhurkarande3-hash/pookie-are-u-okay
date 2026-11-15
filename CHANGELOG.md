# Changelog

## Unreleased — production-mode safety net
Firebase configuration is now required for the normal app experience. Browser-only fictional fixtures require an explicit development flag and are disabled in production builds. A failed Gemini callable now shows an unavailable state instead of returning a scripted reply. TypeScript is pinned to 5.6.3 for reproducible checks.

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
