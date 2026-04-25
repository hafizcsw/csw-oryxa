# خطة بناء السوشال — Hybrid (X + TikTok + Instagram)

## القرار
تنفيذ النمط البصري المشترك بين المنصات الثلاث على Phase 1 الموجودة (جداول `social_posts`, `social_likes`, `social_comments`, `social_follows` + bucket `social-media` جاهزة من المايجريشن السابق).

---

## التخطيط البصري (Layout موحّد)

```text
┌─────────────────────────────────────────────────────────────┐
│  Sidebar       │      Feed Center        │   Right Rail     │
│  (260px)       │      (600px)            │   (320px)        │
│                │                         │                  │
│  Logo          │  ┌─ Stories Row ────┐   │  Search          │
│  Home          │  │ ◉  ◉  ◉  ◉  ◉    │   │  ───────         │
│  Explore       │  └──────────────────┘   │  Trending        │
│  Reels         │                         │   #...            │
│  Notifications │  ┌─ Composer ───────┐   │   #...            │
│  Messages      │  │ "ماذا يحدث؟"     │   │  ───────         │
│  Profile       │  │ 📷 🎬 📊 📍  Post│   │  Who to follow   │
│  ─────         │  └──────────────────┘   │   👤 ...          │
│  [+ Post]      │                         │                  │
│  ─────         │  ┌─ PostCard ───────┐   │                  │
│  Account       │  │ avatar  name·time│   │                  │
│                │  │ text...          │   │                  │
│                │  │ [media full]     │   │                  │
│                │  │ 💬 🔁 ❤ 🔖 ↗   │   │                  │
│                │  └──────────────────┘   │                  │
│                │  ... infinite scroll    │                  │
└─────────────────────────────────────────────────────────────┘
```

**وضع Reels (TikTok)**: full-screen vertical video، تمرير عمودي (snap)، أزرار تفاعل عمودية على اليمين، معلومات الناشر أسفل يسار.

---

## العناصر المشتركة المُستخرَجة من المنصات الثلاث

| النمط | المصدر | تطبيقنا |
|---|---|---|
| Sidebar أيقونة+نص + زر Post كبير | X / TikTok | `SocialSidebar` |
| Stories دوائر متدرجة | Instagram | `StoriesRow` (عرض فقط الآن، بدون upload) |
| Composer علوي مع toolbar | X | `PostComposer` |
| PostCard مع شريط تفاعل سفلي | X / Instagram | `PostCard` |
| Vertical video full-screen + side actions | TikTok | `ReelsViewer` |
| Right rail (Trending / Suggestions) | X / Instagram | `RightRail` |
| Dark theme افتراضي + accent ملوّن | الثلاثة | tokens في `index.css` |
| Tabs "For You / Following" | X / TikTok | `FeedTabs` |

---

## الملفات الجديدة

**Pages** (3):
- `src/pages/social/SocialFeed.tsx` — `/social`
- `src/pages/social/SocialProfile.tsx` — `/social/u/:userId`
- `src/pages/social/SocialReels.tsx` — `/social/reels`

**Layout** (1):
- `src/layouts/SocialLayout.tsx` — Sidebar + Outlet + RightRail (3 أعمدة، responsive)

**Components** (`src/components/social/`):
- `SocialSidebar.tsx` — تنقل + زر Post
- `RightRail.tsx` — بحث + Trending + Suggestions
- `StoriesRow.tsx` — دوائر أفقية scroll
- `FeedTabs.tsx` — For You / Following
- `PostComposer.tsx` — textarea auto-resize + media upload + post
- `PostCard.tsx` — البطاقة الرئيسية
- `PostActions.tsx` — like / comment / repost / save / share
- `MediaViewer.tsx` — صور + فيديو inline
- `ReelsViewer.tsx` — vertical snap-scroll
- `CommentSheet.tsx` — drawer للتعليقات

**Hooks** (`src/hooks/social/`):
- `useSocialFeed.ts` — pagination + infinite scroll
- `useSocialPost.ts` — create/delete
- `useSocialLike.ts` — toggle optimistic
- `useSocialComments.ts`
- `useSocialFollow.ts`

**i18n**: مفاتيح جديدة `social.*` في `src/locales/{12 lang}/common.json` (أو ملف منفصل `social.json`). نص فعلي لـ `en` + `ar`، باقي الـ10 لغات تأخذ نفس مفاتيح en كـ placeholder للحفاظ على الـ12-locale baseline.

---

## Design Tokens (تُضاف في `index.css`)

```css
--social-bg: 222 15% 6%;          /* أسود X */
--social-surface: 222 15% 9%;
--social-border: 222 10% 18%;
--social-text: 210 20% 98%;
--social-muted: 215 15% 60%;
--social-accent: 200 100% 50%;    /* أزرق X */
--social-like: 350 90% 60%;       /* أحمر TikTok/IG heart */
--social-story-ring: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
```

كل ألوان السوشال HSL tokens — لا hex مباشر في المكونات.

---

## السلوك

- **Optimistic UI** للإعجابات والمتابعة (counter يتحدث فوراً، rollback عند الفشل)
- **Infinite scroll** بـ IntersectionObserver، صفحات 20 منشور
- **Realtime** عبر `supabase.channel` لتحديث counters عند تغير `social_posts`
- **Media upload**: صور (jpg/png/webp ≤5MB) + فيديو (mp4 ≤50MB) إلى bucket `social-media/{user_id}/{post_id}/...`
- **Reels detection**: أي منشور بفيديو vertical (height > width) يظهر تلقائياً في `/social/reels`
- **RTL/LTR**: `dir="auto"` على نص المنشور (لأن المحتوى مختلط لغوياً)
- **Auth gate**: التصفح مفتوح للجميع (حسب RLS: SELECT public)، النشر/الإعجاب يتطلب تسجيل دخول → redirect إلى `/auth`

---

## التوجيه (Routing)
يُضاف في `src/App.tsx`:
```
/social              → SocialLayout > SocialFeed
/social/reels        → SocialLayout > SocialReels  
/social/u/:userId    → SocialLayout > SocialProfile
/social/p/:postId    → SocialLayout > SocialPostDetail (Phase 1.2)
```

---

## ما لا يدخل في هذه الجولة (Phase 1.2+)
- Stories upload (عرض فقط الآن)
- Direct Messages (موجود `Messages.tsx` منفصل)
- Live streaming
- Algorithmic ranking (الترتيب الآن: created_at DESC فقط)
- Hashtag pages
- Notifications system
- Repost/Quote (الزر يظهر معطّل مع tooltip "قريباً")

---

## معايير القبول
1. `/social` يفتح ويُظهر feed فارغ + composer
2. مستخدم مسجّل ينشر منشور نصي → يظهر فوراً في أعلى feed
3. رفع صورة + نص → تُخزّن في `social-media` bucket وتظهر في البطاقة
4. زر ❤ يعمل optimistic ويُحدّث `likes_count`
5. الـ 12 لغة لا تُظهر مفاتيح خام (en/ar مترجمة كاملة، باقي اللغات تعرض en fallback بدون أخطاء)
6. RTL يعمل تلقائياً للنصوص العربية داخل بطاقة قد تحوي نص إنجليزي
7. `/social/reels` يعرض فيديوهات vertical بـ snap-scroll يعمل على الموبايل
8. Right rail يختفي < 1024px، Sidebar يصبح bottom nav < 768px

---

## التسليم
بعد الموافقة، تُنفّذ كلها في جولة واحدة (لا migrations جديدة — البنية جاهزة). التحقق النهائي runtime عبر فتح `/social` ونشر منشور تجريبي.
