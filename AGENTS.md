# AGENTS.md

A guide for AI coding agents (Claude Code, Codex, Copilot, Cursor and others) working in this repo. Human contributors can read it too. The product overview is in [README.md](README.md).

## What this is

Pookie is a care and memory companion for older adults: a Next.js 14 web app on Firebase, with Cloud Functions for everything that needs a secret, a schedule or admin rights. It runs fully in **Demo Mode** (no keys, data in `localStorage`) when the Firebase env vars are blank.

## Commands

```bash
npm install                 # web app (Node 22)
npm --prefix functions ci   # Cloud Functions
npm run dev                 # http://localhost:3000, Demo Mode without .env.local
npm run typecheck           # strict tsc, noUncheckedIndexedAccess
npm run lint                # next lint
npm test                    # Vitest unit tests (tests/*.test.ts)
npm run test:rules          # Firestore rules on the emulator (needs Java 11+)
npm run test:e2e            # Playwright + axe (run `npx playwright install chromium` first)
npm --prefix functions run build
npm run build && npm run build:single
```

Before you say a change is done, run `npm run typecheck && npm run lint && npm test`. If you touched `firestore.rules` or `storage.rules`, also run `npm run test:rules`, or say that you could not.

## Where things go

| You are changing | Put it in | Notes |
|---|---|---|
| A business rule (who may see what, dose status, schedules) | `src/lib/domain/` | Pure functions only, with a unit test in `tests/` |
| Logic the server also needs | `functions/src/shared/` | Imported by the web app as `@shared/*`; keep it free of Firebase SDK imports |
| Reading or writing data | `src/lib/data/repository.ts` | Add the method to the interface, then implement it in **both** `demoRepository.ts` and `firebaseRepository.ts` |
| Access control | `firestore.rules` / `storage.rules` | Mirror it in `src/lib/domain/permissions.ts` so Demo Mode behaves the same |
| Anything with a secret, schedule, admin write or cross-user write | `functions/src/` | Region is `asia-south1` |
| User-visible text | `src/lib/i18n/en.ts`, then `hi.ts` | Every key needs both languages (enforced by `tests/i18n.test.ts`) |
| Screens | `src/app/` | Pages never call Firestore directly; use the repository and `domain/` |
| Shared UI | `src/components/ui/` | Large tap targets, visible focus, works at all 3 text sizes |

Path aliases: `@/*` → `src/*`, `@shared/*` → `functions/src/shared/*`.

## Rules you must not break

These are product promises. Each one has tests; if a change makes one fail, the change is wrong.

1. **No response is not a missed dose.** A dose is "Missed" only when the elder taps Missed. Never store `unconfirmed` (`domain/medication.ts`).
2. **A missed check-in is "no response", never an emergency.** Don't alert family about silence (`domain/schedule.ts`).
3. **The elder decides.** Members propose; only the elder accepts, changes, declines or pauses. Help requests are created only by the elder.
4. **Members get exactly the permissions they were given**, only while active, and nothing while sharing is paused.
5. **Private unless shared, item by item.** Check-ins, summaries, visits and memories each have their own share flag.
6. **The AI never invents memories.** It uses only confirmed, AI-allowed LifeBook entries, cites the source, asks when unsure and marks conflicting facts as uncertain (`functions/src/shared/companionContext.ts`, `memoryConflicts.ts`, `persona.ts`).
7. **No diagnosis or medical advice**, including dose changes.
8. **Lock-screen text is generic.** No medicine names or doctors in notifications (`shared/reminderText.ts`).
9. **Store conversation metadata, never words.** Summaries are saved only with consent and the elder's approval.
10. **Demo Mode is honest.** Scripted replies say "scripted, not AI"; nothing is sent or faked.
11. **Look is not gender or age.** Theme and companion are separate choices.

## Conventions

- TypeScript strict with `noUncheckedIndexedAccess`; no `any`.
- Function components; state lives in `src/state/` providers and `src/hooks/`.
- Tailwind with design tokens from `src/lib/theme/tokens.ts` (CSS variables in `globals.css`).
- Respect reduced motion and the three text sizes.
- Sample data and seed accounts are fictional. Never add real people's data.
- Secrets never go in the web app or in `.env.example`. The Gemini key is a Functions secret (`GEMINI_API_KEY`).
- `demo/pookie-demo.html` is a build output of `npm run build:single`. Rebuild it; don't edit it by hand.

## Docs to keep current

When behaviour changes, update the matching doc in the same change: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (data model, functions, enforcement table), [docs/SECURITY.md](docs/SECURITY.md), [docs/AUDIT.md](docs/AUDIT.md) and [CHANGELOG.md](CHANGELOG.md).
