# ✨ POOKIE
### A little care, a lot of love.

<p align="center">
  <strong>Technology that remembers the person, not just the routine.</strong>
</p>

Pookie is an AI-powered elderly care and companionship platform designed to make everyday care more accessible, personal and connected.

We believe that growing older should never mean losing independence, identity or the feeling of being connected to the people who matter.

Pookie brings together personal companionship, healthcare routines, family coordination and memory preservation in one accessible experience.

**Not just another reminder application. Not just another chatbot.**

A companion, a personal memory library and a connected care circle — built around the dignity of the older adult.

---

## 🌷 Why Pookie?

An elderly person may need help remembering a medicine, preparing for a doctor's appointment or staying connected with family.

But care is about more than completing tasks.

It is also about familiar voices, personal stories, meaningful conversations and the comfort of knowing that someone is there.

Most digital healthcare tools focus on tracking what a person needs to do.

Pookie also focuses on the person behind those routines.

## 💗 Meet Pookie

### 🗣️ A companion who listens

A friendly AI companion designed for everyday conversations.

- Voice and text interaction.
- English and Hindi support.
- Personalised companion experiences.
- Accessible interaction and simple controls.
- LifeBook-based personalisation with explicit consent.

Pookie is designed to support companionship, not replace human relationships or professional care.

### 📖 LifeBook — A life worth remembering

LifeBook is Pookie's signature feature.

It is a personal memory library where an older adult can preserve:

- Important people and relationships.
- Personal stories and life experiences.
- Favourite places and meaningful events.
- Photographs and voice memories.
- Everyday routines and preferences.
- Milestones and moments worth remembering.

With permission, Pookie can use confirmed and approved LifeBook entries to make conversations more familiar and meaningful.

Memories are attributed and can be reviewed or corrected. When information is uncertain or missing, Pookie should acknowledge that rather than inventing a memory.

**Because a person's identity is worth preserving.**

### 💊 Everyday healthcare, made simpler

A connected space for everyday healthcare routines.

- Medication schedules.
- Dose tracking.
- Taken, explicitly missed and unconfirmed states.
- Medical profile information.
- Medical documents.
- Visit records and follow-up information.
- Doctor appointment management.
- Emergency contacts.

Pookie does not recommend medication changes or replace medical professionals.

### 👨‍👩‍👧 The Care Circle

Care should be collaborative without taking away independence.

The Care Circle connects older adults with trusted family members and caregivers.

- Individual member permissions.
- Family and caregiver invitations.
- Shared healthcare information where authorised.
- Family suggestions for memories and routines.
- Ability to pause or revoke sharing.
- Elder-controlled decisions.

The older adult remains at the centre of the system.

### 🏡 Alzheimer's-friendly experiences

Pookie includes supportive features designed with cognitive accessibility in mind.

- Simple Mode.
- Orientation assistance.
- Familiar personal memories.
- Family voice reminders.
- Familiar photographs and stories.
- Gentle daily routines.

These features are intended to support familiarity and everyday interaction. They are not a treatment, diagnosis or clinical assessment for Alzheimer's disease.

### 🆘 Emergency assistance

Pookie provides an accessible emergency experience with:

- Emergency contact information.
- Preferred healthcare information.
- A user-initiated emergency call action.
- Location access only when explicitly requested.

For India, the emergency number is 112.

---

## ⭐ What makes Pookie different?

| Traditional reminder apps | Pookie |
|---|---|
| Focus on completing tasks | Focus on the person and their routines |
| Basic medication notifications | Medication tracking and healthcare coordination |
| Limited personal context | LifeBook memory library |
| Generic chatbot interaction | Consent-based personalisation |
| Basic family sharing | Permission-based Care Circle |
| Standard interface | Elder-friendly accessibility experiences |
| Isolated healthcare records | Connected care experience |

Pookie combines practical care with personal connection.

Our central idea is simple:

**Care is not just remembering what someone needs. It is remembering who they are.**

---

## 🎨 Designed for people, not just screens

Pookie offers a calm, approachable interface with:

- Sweet and Cool visual themes.
- Adjustable text sizes.
- Reduced motion preferences.
- English and Hindi.
- Simple Mode.
- Voice interaction.
- Clear, accessible navigation.
- Responsive web design.

The visual experience is designed to feel friendly without making older adults feel infantilised.

---

## 🧠 AI and personalisation

Pookie uses a server-side AI architecture.

The application includes integration paths for:

- Google Gemini.
- Gemini Live.
- OpenAI-compatible providers.
- Adaption Labs.
- Groq.
- OpenRouter.

Provider configuration, fallback behaviour and personal-memory restrictions are handled server-side.

LifeBook information should only be sent to explicitly permitted providers and only when the user has enabled personalisation.

AI responses are not medical advice.

Provider availability and compatibility depend on valid credentials, configuration and live verification.

---

## 🛠️ Technology stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| File storage | Firebase Cloud Storage |
| Backend | Firebase Cloud Functions v2 |
| Scheduling | Cloud Scheduler |
| Notifications | Firebase Cloud Messaging |
| AI | Google Gemini API and Gemini Live API |
| Voice | Google Cloud Text-to-Speech |
| Deployment | Vercel / Firebase deployment configuration |
| Testing | Vitest, Playwright, axe accessibility checks |

---

## 🚀 Try Pookie

### Demo Mode

Pookie can be explored without Firebase credentials or AI API keys.

```bash
git clone https://github.com/madhurkarande3-hash/pookie-are-u-okay.git

cd pookie-are-u-okay

npm install

npm run dev
```

Open:

```text
http://localhost:3000
```

Choose **Explore with sample data**.

Demo Mode:
- Uses fictional sample data.
- Stores demo information in the browser.
- Uses scripted companion replies.
- Clearly identifies itself as Demo Mode.
- Does not send real email or push notifications.

### Single-file demo

```bash
npm run build:single
```

The generated application is available under:

```text
web-single/dist/index.html
```

A prebuilt demo is also available in:

```text
demo/pookie-demo.html
```

---

## 🔐 Privacy, safety and consent

Pookie handles sensitive personal and healthcare information. Privacy is a core product requirement.

Our principles:

1. The older adult remains in control of personal information.
2. Care Circle access is permission-based.
3. Personal memories are never intentionally fabricated.
4. Conversations are not stored as transcripts by the documented companion backend.
5. No response is automatically considered a missed medication dose.
6. No response is automatically treated as an emergency.
7. API secrets remain server-side.
8. Demo data is fictional.
9. Medical information is not exposed to unauthorised members.
10. AI is not a replacement for professional medical care.

Read [Security and Privacy](docs/SECURITY.md).

---

## 🏗️ Project documentation

| Document | Purpose |
|---|---|
| [Competition Judge Guide](docs/COMPETITION-JUDGE-GUIDE.md) | Product story, judging criteria and demonstration |
| [Demo Guide](docs/DEMO.md) | Step-by-step judge walkthrough |
| [Architecture](docs/ARCHITECTURE.md) | Technical architecture and data flow |
| [Security](docs/SECURITY.md) | Privacy, permissions and threat model |
| [Implementation Audit](docs/AUDIT.md) | Implemented, tested and unverified capabilities |
| [Changelog](CHANGELOG.md) | Project development history |

---

## 🧪 Testing

The repository includes automated tests for application logic, security rules and user journeys.

Run:

```bash
npm run typecheck

npm run lint

npm test

npm run test:rules

npm run test:e2e

npm run build
```

Run the commands and inspect their actual results before describing the submission as fully passing.

---

## 🌱 Our vision

We imagine a world where older adults can feel more independent, families can feel more connected, and technology can make care more personal.

Pookie is being built around a simple belief:

**The best technology does not replace care. It helps people care better.**

# POOKIE
### A little care, a lot of love. 💗
