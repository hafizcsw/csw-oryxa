

## Facebook Messenger-style Redesign for Messages Tab

Transform the floating panel's **Messages** section to mirror Facebook's Chats popup: a clean header, segmented filter pills (All / Unread / Support), Messenger-style conversation rows, and a small floating chat bubble that pops out when a conversation is selected — instead of replacing the panel.

### Visual Reference (Facebook Chats)

```text
┌─────────────────────────────────┐
│ Chats              ⋯  ⤢  ✎     │  ← Header (title + actions)
│ 🔍 Search Messenger             │  ← Pill-shaped search
│ [All] [Unread] [Support]        │  ← Segmented filter chips
├─────────────────────────────────┤
│ ◉  Ahmed Mohsen        2h       │
│    أخذ ٢٠٠ دولار...             │  ← Row: avatar + name + preview + time
│ ◉  CSW Support         1d  •    │  ← Unread dot
│    Your ticket has been...       │
│ ◉  Felix Cholec        6d       │
│    Hello Hafez · Reply?          │
└─────────────────────────────────┘
        See all in Messenger →
```

When a row is clicked → a **floating chat bubble window** (Messenger-style mini-chat) slides in from the bottom-right edge of the panel — exactly like the Facebook screenshot — with header [avatar + name + 📞 🎥 — ✕], scrollable messages, and a bottom input. The main list stays visible behind/beside it.

### Sections

1. **Header** — "Chats" title + ⋯ menu, ⤢ expand, ✎ new-message icons. Replaces the current uppercase "MESSAGES" label + ghost "New" button.
2. **Search bar** — pill-shaped input filtering threads by name/subject/preview client-side.
3. **Filter chips** — `All`, `Unread`, `Support` (matching Facebook's All/Unread/Groups/Communities). Active chip = filled primary pill; inactive = muted.
4. **Conversation list** — Messenger row style: 36px circular avatar with first-letter gradient, bold name when unread, single-line preview, relative timestamp, blue unread dot at end. Hover = subtle muted bg, rounded.
5. **Mini-chat popup** — When a thread is selected, render a `MiniChatWindow` overlay anchored bottom-end inside the panel (≈320×420). Header shows name + close (✕) + minimize. Body uses existing `CommThreadView`. Closing returns to list. Multiple selections replace the current popup (single-window mode for simplicity).
6. **Footer** — "See all in Messenger →" link to `/messages` (replaces current quick-input box, since composing now happens inside the popup or via the ✎ icon → `SupportSubmitDialog`).

### Files to change

- **`src/components/portal/support/panel/MessagesTab.tsx`** — full rewrite:
  - Add header row (title + 3 icon buttons).
  - Add search input + filter chip state (`'all' | 'unread' | 'support'`).
  - Filter `sortedThreads` by chip + search query.
  - Replace inline thread view with floating `MiniChatWindow` overlay.
  - Remove bottom quick-compose box; replace with "See all in Messenger" link.
  - Wire ✎ icon to existing `SupportSubmitDialog`.
- **New `src/components/portal/support/panel/MiniChatWindow.tsx`** — Messenger-style popup:
  - Absolute-positioned card (bottom-end, ≈320×420), shadow-2xl, rounded-2xl.
  - Header: avatar + name + minimize/close icons.
  - Body: wraps `CommThreadView` (already includes its own input).
  - RTL-aware positioning (`end-3` works for both LTR/RTL via logical props).
- **`src/components/portal/support/panel/PanelTabs.tsx`** — no change (panel-level tabs stay).
- **i18n keys** — added with `defaultValue` fallbacks (no locale-file edits required for first pass; keys: `portal.support.panel.messages.filters.all|unread|support`, `searchPlaceholder`, `seeAll`).

### Technical Notes

- Filter logic: `unread` = `unread_count > 0`; `support` = `thread_type === 'support'`.
- Search is case-insensitive across `display_name`, `subject`, `last_message_preview`.
- `MiniChatWindow` uses `framer-motion` for slide-up entry (matches existing panel motion language).
- Mobile (`<sm`): popup expands to full panel width/height (no floating bubble — better UX on small screens).
- 12-language ready: all visible strings via `t()` with `defaultValue`.
- No backend changes; uses existing `useCommThreads` and `CommThreadView`.

