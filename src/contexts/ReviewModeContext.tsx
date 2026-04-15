import type { ReactNode } from "react";

/**
 * Review Mode has been removed from the website runtime.
 *
 * This file intentionally remains as a compatibility shim so branches that
 * still touch the old module can merge cleanly without reintroducing behavior.
 * All exports resolve to the standard production path only.
 */

export type ReviewMode = "normal" | "quiet" | "no_ui";

export interface ClientCapabilities {
  ui_events: boolean;
  ack: boolean;
  cards: boolean;
}

export const REVIEW_MODE_STORAGE_KEY = "csw_review_mode";

const DEFAULT_CAPABILITIES: ClientCapabilities = {
  ui_events: true,
  ack: true,
  cards: true,
};

export function ReviewModeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useReviewMode() {
  return {
    mode: "normal" as ReviewMode,
    setMode: (_mode: ReviewMode) => {},
    isNormal: true,
    isQuiet: false,
    isNoUI: false,
    getClientCapabilities: () => DEFAULT_CAPABILITIES,
  };
}
