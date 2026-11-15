/**
 * Reminder wording for push and email. Deliberately generic: no medicine
 * names, doctors or health details ever appear on a lock screen or in an inbox.
 */
import type { ReminderKind } from "./notifyPrefs";

type Lang = "en" | "hi";
const TEXT: Record<Lang, Record<ReminderKind, { title: string; body: string }>> = {
  en: {
    medicine: { title: "Pookie", body: "It's time for a medicine. Open Pookie to say whether you took it." },
    checkin: { title: "Pookie", body: "Time for a little check-in. How are you doing?" },
    appointment: { title: "Pookie", body: "You have an appointment in about an hour." },
    circle: { title: "Pookie", body: "There is a new update in Apne Log." },
  },
  hi: {
    medicine: { title: "पूकी", body: "दवा का समय हो गया है। पूकी खोलकर बताइए कि आपने ली या नहीं।" },
    checkin: { title: "पूकी", body: "थोड़ा हाल-चाल लेने का समय है। आप कैसे हैं?" },
    appointment: { title: "पूकी", body: "लगभग एक घंटे में आपकी मुलाक़ात है।" },
    circle: { title: "पूकी", body: "अपने लोगों में नई जानकारी है।" },
  },
};

export function reminderText(kind: ReminderKind, language: unknown): { title: string; body: string } {
  return TEXT[language === "hi" ? "hi" : "en"][kind];
}
