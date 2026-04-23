/**
 * useNewMessageNotifier
 * Detects new incoming messages on `comm_messages` and CRM support cases via
 * the existing unified inbox stream. When the unread total increases (and the
 * panel isn't currently open on that thread), it:
 *   - plays a short Web Audio beep
 *   - flags `hasNew = true` and remembers the last item's nativeId/source
 * The floating launcher consumes this to show a pulsing badge and to open
 * the Messages tab directly on the incoming conversation.
 *
 * No external audio file required, no business-logic changes.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useUnifiedInbox, type InboxSource } from "./useUnifiedInbox";

interface NewMessageState {
  hasNew: boolean;
  lastNativeId: string | null;
  lastSource: InboxSource | null;
}

function playBeep() {
  try {
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.34);
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // Audio not available — silent fallback.
  }
}

export function useNewMessageNotifier(enabled: boolean = true) {
  const { items } = useUnifiedInbox();
  const [state, setState] = useState<NewMessageState>({
    hasNew: false,
    lastNativeId: null,
    lastSource: null,
  });
  const initializedRef = useRef(false);
  const lastTimestampRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    // Find the most recent unread item (by timestamp).
    const unread = items.filter((i) => i.unread && i.timestamp);
    if (unread.length === 0) {
      // Don't reset hasNew on empty — clearNew() controls that.
      if (!initializedRef.current) initializedRef.current = true;
      return;
    }
    const newest = unread.reduce((acc, i) => {
      const t = new Date(i.timestamp!).getTime();
      const at = acc.timestamp ? new Date(acc.timestamp).getTime() : 0;
      return t > at ? i : acc;
    });
    const newestTs = new Date(newest.timestamp!).getTime();

    if (!initializedRef.current) {
      // First load: don't beep for pre-existing unread, just remember baseline.
      initializedRef.current = true;
      lastTimestampRef.current = newestTs;
      setState({
        hasNew: true,
        lastNativeId: newest.nativeId,
        lastSource: newest.source,
      });
      return;
    }

    if (newestTs > lastTimestampRef.current) {
      lastTimestampRef.current = newestTs;
      playBeep();
      setState({
        hasNew: true,
        lastNativeId: newest.nativeId,
        lastSource: newest.source,
      });
    }
  }, [items, enabled]);

  const clearNew = useCallback(() => {
    setState((s) => ({ ...s, hasNew: false }));
  }, []);

  return {
    hasNew: state.hasNew,
    lastNativeId: state.lastNativeId,
    lastSource: state.lastSource,
    clearNew,
  };
}
