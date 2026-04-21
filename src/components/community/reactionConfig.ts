// Facebook-style reactions config — emoji + colors + labels (AR/EN).
export type ReactionKey = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry' | 'care';

export interface ReactionDef {
  key: ReactionKey;
  emoji: string;
  labelAr: string;
  labelEn: string;
  color: string; // tailwind text color
  bg: string;
}

export const REACTIONS: ReactionDef[] = [
  { key: 'like',  emoji: '👍', labelAr: 'إعجاب',   labelEn: 'Like',  color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  { key: 'love',  emoji: '❤️', labelAr: 'أحب',     labelEn: 'Love',  color: 'text-red-500',     bg: 'bg-red-500/10' },
  { key: 'care',  emoji: '🥰', labelAr: 'أهتم',    labelEn: 'Care',  color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  { key: 'haha',  emoji: '😂', labelAr: 'هاها',    labelEn: 'Haha',  color: 'text-yellow-500',  bg: 'bg-yellow-500/10' },
  { key: 'wow',   emoji: '😮', labelAr: 'واو',     labelEn: 'Wow',   color: 'text-yellow-500',  bg: 'bg-yellow-500/10' },
  { key: 'sad',   emoji: '😢', labelAr: 'حزين',    labelEn: 'Sad',   color: 'text-yellow-600',  bg: 'bg-yellow-600/10' },
  { key: 'angry', emoji: '😡', labelAr: 'غاضب',   labelEn: 'Angry', color: 'text-orange-600',  bg: 'bg-orange-600/10' },
];

export const REACTION_MAP: Record<ReactionKey, ReactionDef> = REACTIONS.reduce(
  (acc, r) => { acc[r.key] = r; return acc; },
  {} as Record<ReactionKey, ReactionDef>
);
