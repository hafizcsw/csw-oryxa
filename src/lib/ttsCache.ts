// IndexedDB-based audio cache for Russian TTS
const DB_NAME = 'russian-tts-cache';
const STORE_NAME = 'audio';
const DB_VERSION = 1;
const CACHE_VERSION = 'v2-russian-pronunciation';

const LATIN_ACUTE_REPLACEMENTS: Record<string, string> = {
  Á: 'А́',
  á: 'а́',
  É: 'Е́',
  é: 'е́',
  Í: 'И́',
  í: 'и́',
  Ó: 'О́',
  ó: 'о́',
  Ú: 'У́',
  ú: 'у́',
  Ý: 'Ы́',
  ý: 'ы́',
};

const RUSSIAN_TTS_OVERRIDES: Record<string, string> = {
  'и краткое': 'и кра́ткое',
  'твёрдый знак': 'твёрдый знак',
  'мягкий знак': 'мя́гкий знак',
  'арбуз': 'арбу́з',
  'автобус': 'авто́бус',
  'луна': 'луна́',
  'банан': 'бана́н',
  'вода': 'вода́',
  'время': 'вре́мя',
  'вечер': 'ве́чер',
  'город': 'го́род',
  'дерево': 'де́рево',
  'обед': 'обе́д',
  'ехать': 'е́хать',
  'если': 'е́сли',
  'море': 'мо́ре',
  'звезда': 'звезда́',
  'зима': 'зима́',
  'игра': 'игра́',
  'имя': 'и́мя',
  'книги': 'кни́ги',
  'йогурт': 'йо́гурт',
  'книга': 'кни́га',
  'урок': 'уро́к',
  'лето': 'ле́то',
  'любовь': 'любо́вь',
  'мама': 'ма́ма',
  'молоко': 'молоко́',
  'небо': 'не́бо',
  'окно': 'окно́',
  'озеро': 'о́зеро',
  'папа': 'па́па',
  'птица': 'пти́ца',
  'рука': 'рука́',
  'работа': 'рабо́та',
  'солнце': 'со́лнце',
  'собака': 'соба́ка',
  'тело': 'те́ло',
  'трава': 'трава́',
  'утро': 'у́тро',
  'улица': 'у́лица',
  'иду': 'иду́',
  'хорошо': 'хорошо́',
  'цветок': 'цвето́к',
  'центр': 'це́нтр',
  'отец': 'оте́ц',
  'человек': 'челове́к',
  'школа': 'шко́ла',
  'шапка': 'ша́пка',
  'карандаш': 'каранда́ш',
  'щенок': 'щено́к',
  'щука': 'щу́ка',
  'овощ': 'о́вощ',
  'объект': 'объе́кт',
  'подъезд': 'подъе́зд',
  'объём': 'объём',
  'рыба': 'ры́ба',
  'это': 'э́то',
  'этаж': 'эта́ж',
  'поэт': 'поэ́т',
  'юбка': 'ю́бка',
  'люблю': 'люблю́',
  'яблоко': 'я́блоко',
  'язык': 'язы́к',
  'семья': 'семья́',
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function replaceMixedAccentGlyphs(value: string) {
  return value.replace(/[ÁáÉéÍíÓóÚúÝý]/g, (char) => LATIN_ACUTE_REPLACEMENTS[char] ?? char);
}

export function normalizeRussianTTSInput(text: string): string {
  const withFixedAccents = replaceMixedAccentGlyphs(text);
  const withoutLatinGloss = withFixedAccents.replace(/\s*\([^)]*[A-Za-z][^)]*\)/g, '');
  const collapsed = normalizeWhitespace(withoutLatinGloss);

  if (!/[А-Яа-яЁё]/.test(collapsed)) {
    return collapsed;
  }

  let normalized = collapsed.toLowerCase();
  normalized = normalized
    .replace(/\s*\/\s*/g, ', ')
    .replace(/\s*↔\s*/g, ', ');

  for (const [source, target] of Object.entries(RUSSIAN_TTS_OVERRIDES)) {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{M}])${escapeRegExp(source)}(?=$|[^\\p{L}\\p{M}])`, 'gu');
    normalized = normalized.replace(pattern, (_match, prefix = '') => `${prefix}${target}`);
  }

  return normalizeWhitespace(normalized);
}

export async function getCachedAudio(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setCachedAudio(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(dataUrl, key);
  } catch {
    // ignore cache write errors
  }
}

export async function fetchAndCacheTTS(text: string, speed: number): Promise<string> {
  const normalizedText = normalizeRussianTTSInput(text);
  const cacheKey = `tts_${CACHE_VERSION}_${normalizedText}_${speed}`;

  // Check IndexedDB cache first
  const cached = await getCachedAudio(cacheKey);
  if (cached) return cached;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/russian-tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ text: normalizedText, speed }),
  });

  if (!response.ok) {
    throw new Error(`TTS HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.audio) throw new Error('No audio in response');

  const audioUrl = `data:audio/mpeg;base64,${data.audio}`;

  // Save to IndexedDB
  await setCachedAudio(cacheKey, audioUrl);

  return audioUrl;
}

export function playAudioUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('Playback failed'));
    audio.play().catch(reject);
  });
}
