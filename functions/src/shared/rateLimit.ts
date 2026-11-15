/** Fixed-window rate limiting for AI calls, per person. Pure; the function stores the state in Firestore. */

export interface RateState {
  minuteStart: number;
  minuteCount: number;
  dayKey: string;
  dayCount: number;
}

export interface RateLimits {
  perMinute: number;
  perDay: number;
}

export const AI_LIMITS: RateLimits = { perMinute: 10, perDay: 300 };

export function consume(state: RateState | undefined, nowMs: number, limits: RateLimits = AI_LIMITS): { allowed: boolean; state: RateState } {
  const minuteStart = Math.floor(nowMs / 60_000) * 60_000;
  const dayKey = new Date(nowMs).toISOString().slice(0, 10);
  const current: RateState = {
    minuteStart,
    minuteCount: state && state.minuteStart === minuteStart ? state.minuteCount : 0,
    dayKey,
    dayCount: state && state.dayKey === dayKey ? state.dayCount : 0,
  };
  if (current.minuteCount >= limits.perMinute || current.dayCount >= limits.perDay) return { allowed: false, state: current };
  return { allowed: true, state: { ...current, minuteCount: current.minuteCount + 1, dayCount: current.dayCount + 1 } };
}
