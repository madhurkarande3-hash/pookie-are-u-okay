"use client";

import { useCallback } from "react";
import { can, type Action } from "@/lib/domain/permissions";
import { useSession } from "@/state/SessionProvider";

/** `allowed("medications:write")` for the current actor, honouring the elder's pause switch. */
export function usePolicy(): (action: Action) => boolean {
  const { session, elder } = useSession();
  const actor = session.status === "ready" ? session.actor : null;
  const sharingPaused = elder?.consent.sharingPaused ?? false;
  return useCallback((action: Action) => can(actor, action, { sharingPaused }), [actor, sharingPaused]);
}
