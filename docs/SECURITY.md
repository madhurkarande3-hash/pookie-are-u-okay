# Security and privacy

Pookie handles health-related information about older adults, so it treats all of it as sensitive. This document lists the threats, the controls that address them (with where each is enforced and tested), and a self-assessment against India's Digital Personal Data Protection Act, 2023.

> **No compliance claim.** This is an engineering self-assessment by the project team, not legal advice or an audit. A qualified lawyer should review it before Pookie handles real people's data.

## Principles

1. **The elder decides.** Nothing about them is visible to anyone else unless they tick it, per person and often per item. One switch pauses all sharing.
2. **Least privilege.** Family and caregivers start with no permissions. Nine separate permissions are granted one by one, and only while their membership is active.
3. **Enforced on the server.** `firestore.rules` and `storage.rules` decide every read and write. The UI and the Demo repository mirror the same policy (`src/lib/domain/permissions.ts`) but are never the last line of defence.
4. **Minimal data.** Conversations are not stored, and neither are their words in metadata. Notices and lock-screen reminders carry no health details. Photos are re-encoded, which strips EXIF and GPS data.
5. **Honest states.** "Missed" is recorded only when the elder says so. A reminder is marked "delivered" only when a device confirms it. Demo replies are labelled "scripted, not AI".

## Threats and controls

| Threat | Control | Where | Tested |
|---|---|---|---|
| A stranger reads someone's data | Every path requires the elder's uid or an active membership with the specific permission | `firestore.rules`, `storage.rules` | Rules tests (emulator) |
| A family member widens their own access | Only the elder can change permissions or status; joining copies exactly the offered permissions from a pending invite for the member's **verified** email, in the same batch | rules (members, invites) | Rules tests |
| A paused member keeps reading | `activeMember()` requires `status == 'active'` and `sharingPaused != true` on every read | rules | Rules + e2e |
| A family member confirms or invents a dose | Dose logs are elder-only; `unconfirmed` cannot be stored | rules (doseLogs) | Rules + unit |
| Fabricated memories reach the AI | Suggestions are created unconfirmed and attributed. The AI only receives confirmed, AI-allowed memories, loaded server-side. Conflicting notes are sent marked uncertain | rules (lifebook), `companionContext.ts`, `memoryConflicts.ts` | Unit |
| Prompt injection via a memory or message | The system instruction says memory and message text is information, never instructions. Facts are loaded server-side; the client cannot inject them. Gemini Live tokens lock the instruction | `companionContext.ts`, `liveToken` | Unit (prompt contents) |
| Leaking the Gemini key | Stored as a Functions secret and never sent to the browser. Gemini Live uses single-use, short-lived tokens | `functions/src/index.ts` | Code review; `NEXT_PUBLIC_*` only in the client |
| AI cost abuse / scripted calls | Per-person limits (10/min, 300/day) in a server-only collection; App Check enforceable on every AI function | `rateLimit.ts`, `ENFORCE_APP_CHECK` | Unit |
| Forged notices or reminders | `notices`, `notifications`, `auditLogs`, `conversationMetadata`, `mail` and `rateLimits` are function-only | rules | Rules tests |
| Health details on a lock screen or in an inbox | Push and email text is generic | `reminderText.ts` | Unit |
| Location leaking from photos | Photos are re-encoded through a canvas, which drops EXIF/GPS | `src/lib/media.ts` | Manual / e2e upload |
| Malicious uploads | 5 MB limit; image/audio content types only; per-uploader folders | `storage.rules`, `sanitize.ts` | Unit (types) |
| Invalid or oversized input | Every write is sanitised client-side and validated again in rules (types, lengths, enums, time/date formats, phone pattern) | `sanitize.ts`, `validation.ts`, rules | Unit + rules |
| Silent changes to who can see what | Audit entries (who, when, which field names, never values) for permissions, invitations, consent, memories, medicines, visits, schedules | `audit.ts` | Unit (entry shape) |
| Losing data | Nightly Firestore export; full export from Settings; account deletion removes data, files and login | `backup.ts`, `deleteMyAccount` | — (needs project) |
| Logging personal data | Functions log counts and error messages only, never user text | all functions | Code review |
| Clickjacking / sniffing | `X-Frame-Options: DENY`, `nosniff`, strict referrer, a permissions policy limiting the microphone to self | `next.config.mjs` | — |

## Consent

| Consent | Default | Effect | Revocable |
|---|---|---|---|
| Use LifeBook in conversations | Off | AI receives confirmed, AI-allowed memories | Settings, any time |
| Save conversation notes | Off | Elder-written, elder-approved note only, after each conversation | Settings; notes deletable |
| Reminders | Off | Browser reminders; server reminders by chosen channel | Settings |
| Each Care Circle permission | Off | Per person | Care Circle screen; pause, edit or remove |
| Share an individual check-in, note, visit or memory | Off for check-ins, notes and memories; on for visits | Per item | Per item |
| Pause all sharing | Off | Nobody in the circle sees anything | One switch |

## India: Digital Personal Data Protection Act, 2023 — self-assessment

**Status of the law (checked 15 Nov 2026).** The DPDP Rules, 2025 were notified on 13–14 November 2025 with three enforcement dates: 14 November 2025, 14 November 2026 and 14 May 2027 ([AMS Shardul](https://www.amsshardul.com/?p=17621)). The phased rollout runs about 18 months, to May 12–14, 2027 ([AZB & Partners](https://www.azbpartners.com/?p=87799)). The Rules also require verifiable consent before processing the data of children, and of persons with disabilities, from their lawful guardian ([tele.net.in](https://tele.net.in/government-notifies-dpdp-rules-2025/)).

| DPDP theme | What Pookie does | Gap / next step |
|---|---|---|
| Notice before consent | "What Pookie keeps" page in plain English and Hindi, linked from welcome, consent and settings | Add a named grievance contact and a notice version/date before launch |
| Specific, informed, unambiguous consent | Separate switches, all off by default; per-person and per-item sharing | Store a consent history (`auditLogs` records changes; add notice version) |
| Withdrawal as easy as giving | Same switches; pause-all; remove a member | — |
| Purpose limitation & minimisation | Conversations not stored; metadata without words; generic notifications; EXIF stripped | Retention periods for check-ins and notes (proposal: user-selectable, default 2 years) |
| Rights: access, correction, erasure | Export all data; edit any record; LifeBook correction history; delete account (data, files, login) | Response-time process for requests received outside the app |
| Reasonable security safeguards | Rules-based access, App Check, rate limits, audit logs, backups, no secrets on client | Breach-response runbook; penetration test |
| Persons with disabilities / lawful guardian | The elder holds all control by design; Care Circle roles are not guardians | **Open:** a guardian-consent flow for users who cannot consent themselves (e.g. advanced dementia) needs legal design. Not built |
| Data processors | Google Cloud / Firebase, Gemini API, Cloud TTS, FCM | Data processing terms; data location (Firestore region `asia-south1` recommended) |

## Reporting a problem

Please do not file public issues for security problems. Contact the maintainers privately (add a security contact before launch).
