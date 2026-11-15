import type { ReactNode } from "react";

export type IconName =
  | "home" | "chat" | "pill" | "book" | "settings" | "calendar" | "heart" | "users" | "check" | "cross"
  | "clock" | "question" | "mic" | "stop" | "pause" | "play" | "plus" | "trash" | "edit" | "shield" | "arrow" | "info" | "bell" | "send" | "camera" | "pin";

const PATHS: Record<IconName, ReactNode> = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" />,
  chat: <path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z" />,
  pill: <><rect x="3" y="8.5" width="18" height="7" rx="3.5" /><path d="M12 8.5v7" /></>,
  book: <path d="M12 6.5C10 5 7 4.8 4 5.5v13c3-.7 6-.5 8 1 2-1.5 5-1.7 8-1v-13c-3-.7-6-.5-8 1zm0 0v13" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />,
  users: <><circle cx="9" cy="9" r="3.2" /><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5M16 6.2a3 3 0 0 1 0 5.6M17.5 14.5c1.9.6 3.1 2.2 3.5 4.5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  cross: <path d="M6 6l12 12M18 6 6 18" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  question: <><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 16.8v.2" /></>,
  mic: <><rect x="9" y="3.5" width="6" height="10.5" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></>,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M5 7h14M9.5 7V4.5h5V7M7 7l.8 12.5h8.4L17 7M10 10.5v6M14 10.5v6" />,
  edit: <path d="M4.5 19.5 5.5 15 16 4.5l3.5 3.5L9 18.5zM14 6.5 17.5 10" />,
  shield: <path d="M12 3.5 5 6v5.5c0 4.4 2.9 7.6 7 9 4.1-1.4 7-4.6 7-9V6zM9 12l2.2 2.2L15.2 10" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.5v.2" /></>,
  bell: <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5h4" />,
  camera: <><path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  pin: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  send: <path d="M4 12 20 4.5 16 20l-4-6zM12 14l8-9.5" />,
};

/** Decorative by default; pair with visible text. */
export function Icon({ name, className = "h-6 w-6" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
