# Architecture

Pookie is a Next.js web app on Firebase. The browser only ever talks to Firestore and Storage through security rules, and to Cloud Functions through authenticated callables. Every secret and every AI prompt lives on the server.

```
Browser (Next.js, React)                         Google Cloud / Firebase
──────────────────────────                       ─────────────────────────────────────────────
pages → domain/ (pure rules) → Repository ──────▶ Firestore  (firestore.rules)
                                    │      ──────▶ Storage    (storage.rules)
                                    └ DemoRepository (localStorage, same policy) in Demo Mode
companion → callable ──────────────────────────▶ companionReply → Gemini API
          → callable ──────────────────────────▶ speak          → Cloud Text-to-Speech
          → callable → token → WebSocket ───────▶ liveToken      → Gemini Live API
service worker ◀──── FCM web push ◀───────────── reminderSweep (Cloud Scheduler, every 5 min)
                                                 notifyOn* / audit* triggers, nightlyBackup, emailInvitation
```

## Layers

| Layer | Where | Rule |
|---|---|---|
| UI | `src/app`, `src/components` | Never call Firestore directly; use `Repository` and `domain/` |
| Business rules | `src/lib/domain`, `functions/src/shared` | Pure functions, unit-tested; shared modules are imported by both the web app and the functions |
| Storage | `src/lib/data` | `Repository` interface; `FirebaseRepository` (rules-enforced) and `DemoRepository` (applies the same policy in the browser) |
| Server | `functions/src` | Everything needing a secret, a schedule, admin rights or cross-user writes |

## Data model

Everything about one elder lives under `elders/{elderId}` (`elderId` = the elder's auth uid), so a single membership check decides access.

| Path | Holds | Writes | Reads |
|---|---|---|---|
| `users/{uid}` | Role, linked elder, name | Owner | Owner |
| `users/{uid}/settings/notify` | Timezone, quiet hours, reminder kinds, channels | Owner | Owner; reminderSweep |
| `users/{uid}/devices/{id}` | Web push tokens | Owner | Owner; reminderSweep |
| `users/{uid}/notices/{id}` | Content-free "something was shared / help was asked" | Functions only | Owner (may mark read) |
| `elders/{id}` | Profile, look, companion, phone, consents | Elder | Elder, active members |
| `…/invites/{email}` | Pending/declined invitations with offered permissions | Elder; invitee accepts or declines | Elder; invitee (by verified email) |
| `…/members/{uid}` | Membership: role, status, 9 per-person permissions | Elder (permissions, pause); member may leave | Elder; the member |
| `…/medications`, `…/doseLogs` | Medicines (frequency, dates, instructions); explicit Taken/Missed only | Elder; Manage care (medicines) | Elder; permitted members |
| `…/appointments` | Visits (prep, status, per-visit visibility) | Elder; Manage care | Elder, managers; viewers only shared visits |
| `…/checkins` | Mood, sleep, energy, help needed, note | Elder | Elder; members only when shared |
| `…/schedules` | Daily and one-off check-in times; proposals | Elder decides; members propose | Elder, active members |
| `…/summaries` | Elder-approved conversation notes (never transcripts) | Elder, with consent | Elder; members only when shared |
| `…/lifebook` | Memories with source, confirmation, sharing, people links, media ref, correction history | Elder; members suggest (unconfirmed, attributed) | Elder; viewers only shared; contributors their own |
| `…/helpRequests` | "I'd like some help" | Elder creates; helpers acknowledge as themselves | Elder; members with Receive help |
| `…/notifications` | Planned reminders, per-channel status, attempts | Functions only (elder records delivery) | Elder |
| `…/conversationMetadata` | Time, language, persona, length — never words | Functions only | Elder |
| `…/auditLogs` | Who changed which fields of permissions, consent, memories, medicines | Functions only | Elder |
| Storage `elders/{id}/media/{uploader}/…` | Photos (resized, EXIF stripped) and voice memories | Elder; contributors into their own folder | Same as the memory's permission |
| `rateLimits/{uid_bucket}`, `mail/{id}` | AI quotas; email queue | Functions only | Nobody |

## Cloud Functions (asia-south1)

| Function | Trigger | Purpose |
|---|---|---|
| `companionReply` | Callable (elder) | Gemini reply. Consent, persona and approved LifeBook facts are loaded server-side; conflicting facts are marked uncertain; rate limited; App Check-enforceable; writes metadata only |
| `speak` | Callable (elder) | Cloud TTS audio in the companion's own voice (Kaka male, Granny female, en-IN / hi-IN) |
| `liveToken` | Callable (elder) | Single-use Gemini Live token; model, voice and system instruction are locked server-side |
| `reminderSweep` | Every 5 min | Plans due reminders per elder in their timezone; deterministic ids prevent duplicates; FCM push and/or email; retries 5/15/45 min |
| `notifyOnSharedCheckin`, `notifyOnSharedSummary`, `notifyOnHelpRequest` | Firestore writes | Content-free notices and opt-in push to permitted members only; nothing while sharing is paused |
| `auditElderProfile`, `auditMembers`, `auditInvites`, `auditLifebook`, `auditMedications`, `auditAppointments`, `auditSchedules` | Firestore writes (with auth context) | Field-name-only audit entries |
| `deleteMyAccount` | Callable | Elder: whole tree, Storage files and Auth user. Member: membership, own data and Auth user |
| `emailInvitation` | Invite created | Invitation email via Trigger Email (when enabled) |
| `nightlyBackup` | Daily 02:30 IST | Firestore export to `BACKUP_BUCKET` |

## How the important rules are enforced

| Rule | Enforced in |
|---|---|
| No response ≠ missed dose; "Missed" only when the elder says so | `domain/medication.ts`; rules reject a stored `unconfirmed`; only the elder writes dose logs |
| A missed check-in is "no response", never an emergency | `domain/schedule.ts` (`slotState`); reminders go only to the elder |
| Members get exactly what was ticked, only while active, nothing while sharing is paused | `firestore.rules` (`hasPerm`, `activeMember`), `storage.rules`, `domain/permissions.ts` |
| Joining needs a pending invite for your verified email, with exactly the offered permissions | `firestore.rules` (members create, `getAfter`) |
| Family proposes; only the elder accepts, changes, declines or pauses | rules (schedules) + `decideSchedule` |
| Private unless shared, item by item (check-ins, notes, visits, memories) | rules `shareWithCircle` / `shared` + matching queries |
| Help is sent only when the elder presses the button | rules (elder-only create) + `shouldNotify` |
| The AI uses only confirmed, AI-allowed memories, cites the source, asks when unsure, flags conflicts, makes no diagnosis, never claims a shared past | `functions/src/shared/companionContext.ts`, `persona.ts`, `memoryConflicts.ts` |
| Reminders respect timezone, quiet hours and chosen kinds; never sent twice | `shared/notifyPrefs.ts`, `shared/reminderPlan.ts`, deterministic ids |
| "Delivered" only when a device confirms it | `deliveredAt` written by the elder's own device; rules allow only that field |
| Lock screens never show medicine names or doctors | `shared/reminderText.ts` (tested) |
| Theme is never tied to gender or age | Look and companion are independent choices (`LookAndCompanion.tsx`) |
