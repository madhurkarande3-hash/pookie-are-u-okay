# Demo for judges (about 6 minutes)

Every person in the demo is **fictional**. Nothing real is used.

## Option A: the deployed site (real Firebase + Gemini)

Sign in with the demo accounts created by `functions/scripts/seed-demo.mjs`:

| Account | Role |
|---|---|
| `asha.demo@example.com` | The elder (Asha) |
| `priya.demo@example.com` | Family member (daughter) |
| `ravi.demo@example.com` | Caregiver |

The password is shared privately with the judges.

## Option B: Demo Mode (no accounts, works offline)

Open the app, or `demo/pookie-demo.html`, and choose **Explore with sample data**. Demo Mode labels everything honestly: companion replies say "scripted, not AI", and nothing is sent anywhere.

## The walkthrough

1. **Choose a look and a companion — separately.** Settings → Display: switch Sweet ↔ Cool (colours and lettering), then pick Pookie, Granny Pookie or Kaka Pookie. Neither choice depends on the other. Switch to **हिन्दी**: the whole app changes language, and the theme stays.
2. **Home.** It shows a gentle orientation card (today's date, part of the day, a usual routine, an approved photo), today's check-ins, medicines, the next appointment, the Care Circle and a help card. Nothing on it quizzes the elder.
3. **Honest medicine states.** Medicines: a dose whose time has passed shows **Not confirmed**, never "missed". Press *I took it* → **Taken**. Medicine history shows yesterday's *Missed* dose, which Asha reported herself.
4. **A companion that doesn't make things up.** Talk → type "Tell me about Rohan": the reply comes from the LifeBook and says who added it. Then "Who is Meena?": the companion says it doesn't know and **won't guess**. With the real server, try *Talk in real time (preview)* for Gemini Live, or listen to Kaka's own voice.
5. **LifeBook.** A memory suggested by Priya is waiting for Asha to approve. Add "Priya — niece" in My People: **Two notes disagree** appears, and the AI is told to ask, not choose. Add a photo (it's resized and its location data removed) or record a voice memory.
6. **Care Circle on the elder's terms.** Care Circle → *Demo: view as Ravi*. Ravi sees medicines and visits (he manages care), but not check-ins. Go back, turn on **Pause all sharing**, and view as Ravi again: he sees nothing.
7. **Proposals and help.** Accept Priya's suggested "Video call" time (or change the time). On Home press **I'd like some help** → send. View as Priya: the request is there → *I'm on it*. Back as Asha: "Priya saw it and is on it". Nothing like this is ever sent automatically.
8. **Privacy.** Open *What Pookie keeps*. In Settings: reminder quiet hours and timezone, data export, and account deletion.

## Smoke checks after a real deploy

- [ ] Sign up, verify email, password reset email arrives
- [ ] Elder onboarding writes `elders/{uid}`; a stranger account cannot read it
- [ ] Invite → accept as the invitee (same email) → permissions match the invite; decline works
- [ ] Companion reply shows "Gemini AI"; `conversationMetadata` has no message text
- [ ] `speak` returns audio in the chosen companion's voice; Gemini Live connects
- [ ] Turn on push in Settings → a reminder arrives with the app closed → `deliveredAt` is set after opening it
- [ ] Check-in shared → the permitted member receives a notice; nothing while sharing is paused
- [ ] Photo upload → only permitted members can load it
- [ ] Delete account → data, files and login are gone
- [ ] `npm run test:rules` passes against the deployed rules
