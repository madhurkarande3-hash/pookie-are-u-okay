# Project audit — 15 November 2026

Each master-prompt phase, with what is built and how it was verified.

- **Verified** = an automated test or a scripted browser run exercised it in this repo.
- **Implemented** = written and type-checked against the real SDKs, but not yet run against live Google services, because the build environment has no Firebase project or keys.

## Status by phase

| Phase | Status | Verified by | Still open |
|---|---|---|---|
| 2 Design & accessibility | Done | Two themes (look only) + three companions; English/Hindi with a Devanagari font; 3 text sizes; reduced motion; skip link; axe WCAG 2.1 AA: 0 serious/critical on 9 screens × 2 themes × phone/desktop | Manual screen-reader pass (NVDA/TalkBack) |
| 3 Auth & onboarding | Done | Sign-up, sign-in, Google, verification, password reset, sign-out; profile editing; timezone, quiet hours, reminder kinds and channels; privacy page; consents off by default; optional steps skippable; e2e onboarding | Live run of the password reset email |
| 4 Home | Done | Greeting, companion, clock, orientation card, check-ins, medicines, next visit, Care Circle, help; separate family dashboard; e2e | — |
| 5 AI companion | Implemented (Demo verified) | Text + browser voice, Listening/Thinking/Speaking, interrupt, pause, end; Gemini replies server-side with server-loaded facts; Cloud TTS persona voices; Gemini Live preview with single-use tokens and one reconnect; consent before notes; Demo honesty (e2e) | Live run with a Gemini key and the current Live model name |
| 6 LifeBook | Done | 8 sections; photos (EXIF stripped) and voice memories; dates, relationships, links to people; search; family suggestions + approval; correction history; conflict detection told to the AI as uncertain; per-memory sharing; audit; e2e + unit | Storage rules on a live bucket |
| 7 Medicines | Done | Frequency, start/end dates, instructions, times; Taken / Missed (explicit) / Not confirmed; history by day; permission-gated; never suggests dose changes; unit + e2e | — |
| 8 Appointments | Done | Add/edit/delete; prep; scheduled/completed/cancelled + history; per-visit visibility; reminders 1 h before | Calendar sync (not built) |
| 9 Check-ins | Done | Mood, sleep, energy, help needed; spoken note; history; optional sharing; follow-up check-in; "I'd like some help" (elder-initiated only); missed slot = "no response" | — |
| 10 Care Circle | Done | Invite, accept/decline, multiple members, 9 permissions, pause/resume/remove, pause-all, proposals accepted/modified/declined/paused, help requests, contact the elder; rules + e2e | Live run of the invitation email |
| 11 Reminders & notifications | Implemented | Server sweep: timezone, quiet hours (deferred delivery), kinds, deterministic ids (no duplicates), FCM + email, retries 5/15/45, honest `sent` vs `deliveredAt`; generic lock-screen text; planner unit-tested | Live FCM/Scheduler run |
| 12 Backend | Implemented | Collections, rules, indexes, Storage rules, 18 functions, validation in client and rules, export, account deletion, backups | First deploy |
| 13 Security & privacy | Done (design) | See SECURITY.md: RBAC, App Check switch, rate limits, audit logs, minimised logs, DPDP self-assessment | Guardian-consent flow; legal review; pen test |
| 14 Testing | Done | 109 unit tests, 22 e2e/a11y checks, ~35 rules tests (CI emulator), typecheck, lint, builds | Rules tests have not run locally (emulator download blocked here) — CI runs them |
| 15 Deployment | Ready, not deployed | Production build, `apphosting.yaml`, env docs, CI, seed script, one-file Demo | Firebase project + keys; deployed URL |

## Fixed during this work

- A theme was tied to gender (Grandma/Grandpa). It is now a look only, and the companion is a separate choice.
- Default check-in names stayed English after switching to Hindi.
- The medicine list showed "00:30" while the card showed "12:30 am".
- An expression-bodied React effect crashed navigation in the one-file build.
- The skip link conflicted with hash routing.
- The privacy table scrolled sideways on phones; it is now readable cards.
- Kaka's cap rendered as a dark blob; he was redrawn.
- The voice-engine label claimed browser speech in server mode.
- An audit trigger fired on every reminder write; it is now one trigger per collection.
- The help-button Hindi text was gendered; it is now neutral.

## Remaining (not built)

- Google Calendar sync for appointments
- Guardian consent for people who cannot consent for themselves (needs legal design)
- An in-app reminder history screen (the data exists in `notifications`)
- Native mobile apps (the web app is responsive and installable)
