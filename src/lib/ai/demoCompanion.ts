import type { CompanionFact, CompanionLanguage } from "@shared/companionContext";
import { DEFAULT_PERSONA, type CompanionPersona } from "@shared/persona";

/**
 * Demo Mode companion: a small, fully scripted responder. It is NOT an AI
 * model and the UI labels every reply as scripted. It follows the same rule
 * as the real companion: it only repeats confirmed LifeBook facts and says
 * so plainly when it does not know something.
 */

interface Script {
  greeting: (name: string) => string;
  fact: (title: string, detail: string, addedBy: string) => string;
  /** Two approved notes disagree: ask, never choose. */
  uncertain: (title: string) => string;
  self: string;
  unknown: string;
  medical: string;
  prompts: readonly string[];
}

/**
 * Pookie is warm and gender-neutral (its Hindi avoids gendered verb endings);
 * Granny Pookie talks like a dear old friend; Kaka Pookie like a friendly old
 * buddy. Hindi verbs agree with the speaker: रही (Granny) / रहा (Kaka).
 * Only the tone differs — the safety replies say the same thing in all three.
 */
const SCRIPTS: Record<CompanionPersona, Record<CompanionLanguage, Script>> = {
  pookie: {
    en: {
      greeting: (name) => (name ? `Hello, ${name}. It is lovely to hear from you. How are you feeling right now?` : "Hello. It is lovely to hear from you. How are you feeling right now?"),
      fact: (title, detail, addedBy) => `Your LifeBook has a note about ${title}: “${detail}” (added by ${addedBy}). Would you like to tell me more?`,
      self: "you",
      uncertain: (title) => `Your LifeBook has two different notes about ${title}, so I won't guess. Would you like to tell me which one is right?`,
      unknown: "I don't have that in your LifeBook, so I won't guess. Would you like to tell me about it, or add it to your LifeBook?",
      medical: "I can't give medical advice. Please talk to your doctor, or ask someone in your Care Circle to help you reach them. If it feels urgent, call your local emergency number.",
      prompts: ["I'm listening. Tell me a little more.", "Thank you for telling me. What else is on your mind?", "That sounds important to you. How did it make you feel?"],
    },
    hi: {
      greeting: (name) => (name ? `नमस्ते, ${name}। आपसे बात करके अच्छा लगा। अभी आप कैसा महसूस कर रहे हैं?` : "नमस्ते। आपसे बात करके अच्छा लगा। अभी आप कैसा महसूस कर रहे हैं?"),
      fact: (title, detail, addedBy) => `आपकी लाइफ़बुक में ${title} के बारे में लिखा है: “${detail}” (${addedBy} ने जोड़ा)। क्या आप इसके बारे में और बताना चाहेंगे?`,
      self: "आप",
      uncertain: (title) => `आपकी लाइफ़बुक में ${title} के बारे में दो अलग बातें लिखी हैं, इसलिए अंदाज़ा लगाना ठीक नहीं होगा। क्या आप बताना चाहेंगे कि कौन-सी सही है?`,
      unknown: "यह आपकी लाइफ़बुक में नहीं है, इसलिए अंदाज़ा लगाना ठीक नहीं होगा। क्या आप मुझे बताना चाहेंगे, या इसे लाइफ़बुक में जोड़ना चाहेंगे?",
      medical: "चिकित्सा सलाह देना मेरे लिए सही नहीं है। कृपया अपने डॉक्टर से बात करें, या अपने केयर सर्कल से मदद माँगें। अगर ज़रूरी लगे तो अपने स्थानीय आपातकालीन नंबर पर कॉल करें।",
      prompts: ["बताइए, मेरा पूरा ध्यान आपकी बात पर है।", "बताने के लिए धन्यवाद। और क्या मन में है?", "यह आपके लिए ज़रूरी लगता है। आपको कैसा लगा?"],
    },
  },
  granny: {
    en: {
      greeting: (name) => (name ? `Hello, ${name}, my dear! It's so lovely to hear from you. How are you feeling today?` : "Hello, my dear! It's so lovely to hear from you. How are you feeling today?"),
      fact: (title, detail, addedBy) => `Your LifeBook has a note about ${title}: “${detail}” (added by ${addedBy}). That's lovely — would you like to tell me more?`,
      self: "you",
      uncertain: (title) => `My dear, your LifeBook has two different notes about ${title}, so I won't guess. Which one is right?`,
      unknown: "I don't have that in your LifeBook, my dear, so I won't guess. Would you like to tell me about it, or add it to your LifeBook?",
      medical: "I can't give medical advice, my dear. Please talk to your doctor, or ask someone in your Care Circle to help you reach them. If it feels urgent, call your local emergency number.",
      prompts: ["I'm listening, dear. Tell me a little more.", "Thank you for sharing that with me. What else is on your mind?", "Oh, that sounds important to you. How did it make you feel?"],
    },
    hi: {
      greeting: (name) => (name ? `नमस्ते, ${name} जी! आपसे बात करके मन खुश हो गया। आज आप कैसा महसूस कर रहे हैं?` : "नमस्ते जी! आपसे बात करके मन खुश हो गया। आज आप कैसा महसूस कर रहे हैं?"),
      fact: (title, detail, addedBy) => `आपकी लाइफ़बुक में ${title} के बारे में लिखा है: “${detail}” (${addedBy} ने जोड़ा)। कितनी प्यारी बात है — और बताइए ना?`,
      self: "आप",
      uncertain: (title) => `आपकी लाइफ़बुक में ${title} के बारे में दो अलग बातें लिखी हैं, इसलिए मैं अंदाज़ा नहीं लगाऊँगी। बताइए ना, कौन-सी सही है?`,
      unknown: "यह आपकी लाइफ़बुक में नहीं है, इसलिए मैं अंदाज़ा नहीं लगाऊँगी। क्या आप मुझे बताना चाहेंगे, या इसे लाइफ़बुक में जोड़ना चाहेंगे?",
      medical: "मैं चिकित्सा सलाह नहीं दे सकती। कृपया अपने डॉक्टर से बात करें, या अपने केयर सर्कल से मदद माँगें। अगर ज़रूरी लगे तो अपने स्थानीय आपातकालीन नंबर पर कॉल करें।",
      prompts: ["मैं सुन रही हूँ, बताइए ना।", "मुझसे बाँटने के लिए शुक्रिया। और क्या मन में है?", "यह बात आपके दिल के क़रीब लगती है। आपको कैसा लगा?"],
    },
  },
  kaka: {
    en: {
      greeting: (name) => (name ? `Hello there, ${name}, my friend! Good to hear your voice. How's the day treating you?` : "Hello there, my friend! Good to hear your voice. How's the day treating you?"),
      fact: (title, detail, addedBy) => `Your LifeBook has a note about ${title}: “${detail}” (added by ${addedBy}). Now that's worth a chat — tell me more?`,
      self: "you",
      uncertain: (title) => `My friend, your LifeBook has two different notes about ${title}, so I won't guess. Which one is right?`,
      unknown: "That's not in your LifeBook, my friend, so I won't guess. Want to tell me about it, or add it to your LifeBook?",
      medical: "I can't give medical advice, my friend. Please talk to your doctor, or ask someone in your Care Circle to help you reach them. If it feels urgent, call your local emergency number.",
      prompts: ["I'm all ears, my friend. Go on.", "Thanks for telling me. What else is on your mind?", "Sounds like that matters to you. How did it make you feel?"],
    },
    hi: {
      greeting: (name) => (name ? `अरे नमस्ते, ${name} जी! आपकी आवाज़ सुनकर अच्छा लगा, दोस्त। आज दिन कैसा चल रहा है?` : "अरे नमस्ते, दोस्त! आपकी आवाज़ सुनकर अच्छा लगा। आज दिन कैसा चल रहा है?"),
      fact: (title, detail, addedBy) => `आपकी लाइफ़बुक में ${title} के बारे में लिखा है: “${detail}” (${addedBy} ने जोड़ा)। वाह, इस पर तो बात बनती है — और बताइए?`,
      self: "आप",
      uncertain: (title) => `दोस्त, आपकी लाइफ़बुक में ${title} के बारे में दो अलग बातें लिखी हैं, इसलिए मैं अंदाज़ा नहीं लगाऊँगा। कौन-सी सही है?`,
      unknown: "यह आपकी लाइफ़बुक में नहीं है, दोस्त, इसलिए मैं अंदाज़ा नहीं लगाऊँगा। क्या आप मुझे बताना चाहेंगे, या इसे लाइफ़बुक में जोड़ना चाहेंगे?",
      medical: "मैं चिकित्सा सलाह नहीं दे सकता, दोस्त। कृपया अपने डॉक्टर से बात करें, या अपने केयर सर्कल से मदद माँगें। अगर ज़रूरी लगे तो अपने स्थानीय आपातकालीन नंबर पर कॉल करें।",
      prompts: ["मैं सुन रहा हूँ, दोस्त। आगे बताइए।", "बताने के लिए शुक्रिया। और क्या मन में है?", "लगता है यह बात आपके लिए ख़ास है। आपको कैसा लगा?"],
    },
  },
};

// \b only understands ASCII letters, so the end of the greeting is matched explicitly.
const GREETING_RE = /^(hi|hello|hey|namaste|good (morning|afternoon|evening)|नमस्ते|नमस्कार|हेलो|हैलो)(?=$|[\s,.!?।])/i;
const QUESTION_RE = /\b(who|when|where|what is my|what was my|do you remember|remember)\b|कौन|कब|कहाँ|याद/i;
const DATE_RE = /\b(what (day|date|time)|which day|today'?s date)\b|आज कौन|कौन सा दिन|क्या तारीख|कितने बजे/i;
const MEDICAL_RE = /\b(pain|dizzy|dose|tablet|medicine|pill|diagnos|alzheimer|dementia|chest|doctor said)\b|दर्द|दवा|गोली|चक्कर/i;

export interface DemoReplyInput {
  text: string;
  facts: readonly CompanionFact[];
  language: CompanionLanguage;
  preferredName: string;
  /** Number of user turns so far; rotates the neutral prompts deterministically. */
  turn: number;
  persona?: CompanionPersona;
}

export function demoReply({ text, facts, language, preferredName, turn, persona = DEFAULT_PERSONA }: DemoReplyInput): string {
  const script = SCRIPTS[persona][language];
  const lower = text.toLowerCase();

  const fact = facts.find((f) => f.title.trim().length > 1 && lower.includes(f.title.trim().toLowerCase()));
  if (DATE_RE.test(text)) {
    const now = new Date();
    const locale = language === "hi" ? "hi-IN" : "en-IN";
    const when = `${now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${now.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
    return language === "hi" ? `आज ${when} है।` : `Today is ${when}.`;
  }
  if (fact?.uncertain) return script.uncertain(fact.title);
  if (fact?.about && fact.category === "photos") {
    return language === "hi" ? `इस तस्वीर में ${fact.about} हैं। आपने यह तस्वीर अपनी लाइफ़बुक में जोड़ी है।` : `That's ${fact.about} in "${fact.title}". This photo is in your LifeBook.`;
  }
  if (fact) return script.fact(fact.title, fact.detail, fact.addedBy === "self" ? script.self : fact.addedBy);
  if (MEDICAL_RE.test(text)) return script.medical;
  if (QUESTION_RE.test(text)) return script.unknown;
  if (GREETING_RE.test(text.trim())) return script.greeting(preferredName);
  return script.prompts[turn % script.prompts.length] ?? script.unknown;
}
