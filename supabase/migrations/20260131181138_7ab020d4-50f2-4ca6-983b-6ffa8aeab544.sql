-- إضافة إعدادات شريط الأخبار إلى feature_settings
INSERT INTO feature_settings (key, value)
VALUES ('news_ticker', '{
  "enabled": true,
  "text_en": "🚀 BREAKING: ORYXA Coin Coming Soon - Our Exclusive Crypto Launch! 🪙   •   💸 NEW: Money Transfer to Russia Opening Soon - Fast & Secure! 🇷🇺",
  "label_en": "BREAKING",
  "bg_color": "#111827",
  "label_color": "#DC2626",
  "text_color": "#FFFFFF",
  "speed_seconds": 15
}'::jsonb)
ON CONFLICT (key) DO NOTHING;