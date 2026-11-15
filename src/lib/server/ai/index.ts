import "server-only";
import { AIProviderManager } from "./manager";

/** The one server-side entry point for text AI. Keys stay in process.env. */
export function getAIManager(): AIProviderManager {
  return new AIProviderManager(process.env, fetch);
}
export { NoProviderError } from "./manager";
