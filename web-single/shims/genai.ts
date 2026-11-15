/** The one-file Demo build never talks to Gemini; this keeps the SDK out of the bundle. */
export const Modality = { AUDIO: "AUDIO" } as const;
export class GoogleGenAI {
  constructor() {
    throw new Error("Gemini is not available in Demo Mode");
  }
}
