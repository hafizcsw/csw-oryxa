-- Create slider content translation table
CREATE TABLE IF NOT EXISTS slider_content_i18n (
  id BIGSERIAL PRIMARY KEY,
  locale TEXT NOT NULL CHECK (locale IN ('ar', 'en')),
  
  -- Hero Slide 1 - Study Abroad
  slide1_badge TEXT NOT NULL DEFAULT '🎓 Study Abroad',
  slide1_title TEXT NOT NULL DEFAULT 'Your Future Starts Here',
  slide1_subtitle TEXT NOT NULL DEFAULT 'Join 50,000+ students who found their dream university with us',
  slide1_description TEXT NOT NULL DEFAULT 'Access top universities worldwide with personalized guidance every step of the way. From application to arrival, we''re with you.',
  slide1_cta TEXT NOT NULL DEFAULT 'Start Your Journey',
  
  -- Hero Slide 2 - AI Counselor
  slide2_badge TEXT NOT NULL DEFAULT '🤖 AI-Powered',
  slide2_title TEXT NOT NULL DEFAULT 'Meet Your AI Academic Counselor',
  slide2_subtitle TEXT NOT NULL DEFAULT 'Get instant personalized university recommendations',
  slide2_description TEXT NOT NULL DEFAULT 'Our advanced AI analyzes your profile, preferences, and goals to match you with the perfect universities and programs.',
  slide2_cta TEXT NOT NULL DEFAULT 'Try AI Advisor',
  
  -- Hero Slide 3 - Success Stories  
  slide3_badge TEXT NOT NULL DEFAULT '⭐ Success Stories',
  slide3_title TEXT NOT NULL DEFAULT 'Join Thousands of Success Stories',
  slide3_subtitle TEXT NOT NULL DEFAULT '98% of our students get accepted to their dream university',
  slide3_description TEXT NOT NULL DEFAULT 'With comprehensive support from application to visa and beyond, we ensure your study abroad journey is smooth and successful.',
  slide3_cta TEXT NOT NULL DEFAULT 'Read Success Stories',
  
  -- Stats Labels
  stats_students_label TEXT NOT NULL DEFAULT 'Students',
  stats_universities_label TEXT NOT NULL DEFAULT 'Universities',  
  stats_countries_label TEXT NOT NULL DEFAULT 'Countries',
  stats_service_label TEXT NOT NULL DEFAULT 'Service',
  stats_service_value TEXT NOT NULL DEFAULT 'Free',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(locale)
);

-- Enable RLS
ALTER TABLE slider_content_i18n ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "slider_content_public_read" ON slider_content_i18n
  FOR SELECT USING (true);

-- Admin write access
CREATE POLICY "slider_content_admin_write" ON slider_content_i18n
  FOR ALL USING (is_admin(auth.uid()));

-- Insert Arabic translations
INSERT INTO slider_content_i18n (locale, 
  slide1_badge, slide1_title, slide1_subtitle, slide1_description, slide1_cta,
  slide2_badge, slide2_title, slide2_subtitle, slide2_description, slide2_cta,
  slide3_badge, slide3_title, slide3_subtitle, slide3_description, slide3_cta,
  stats_students_label, stats_universities_label, stats_countries_label, 
  stats_service_label, stats_service_value
) VALUES (
  'ar',
  '🎓 الدراسة بالخارج', 'مستقبلك يبدأ من هنا', 'انضم إلى 50,000+ طالب وجدوا جامعة أحلامهم معنا',
  'احصل على القبول في أفضل الجامعات العالمية مع إرشاد شخصي في كل خطوة. من التقديم حتى الوصول، نحن معك.',
  'ابدأ رحلتك الآن',
  
  '🤖 مدعوم بالذكاء الاصطناعي', 'قابل مستشارك الأكاديمي بالذكاء الاصطناعي', 
  'احصل على توصيات جامعية مخصصة فوراً',
  'يحلل الذكاء الاصطناعي المتقدم لدينا ملفك الشخصي وتفضيلاتك وأهدافك لمطابقتك مع الجامعات والبرامج المثالية.',
  'جرّب المستشار الذكي',
  
  '⭐ قصص النجاح', 'انضم إلى آلاف قصص النجاح', '98٪ من طلابنا يحصلون على القبول في جامعة أحلامهم',
  'مع الدعم الشامل من التقديم إلى التأشيرة وما بعدها، نضمن أن تكون رحلة دراستك بالخارج سلسة وناجحة.',
  'اقرأ قصص النجاح',
  
  'طالب', 'جامعة', 'دولة', 'الخدمة', 'مجاناً'
) ON CONFLICT (locale) DO NOTHING;

-- Insert English translations  
INSERT INTO slider_content_i18n (locale,
  slide1_badge, slide1_title, slide1_subtitle, slide1_description, slide1_cta,
  slide2_badge, slide2_title, slide2_subtitle, slide2_description, slide2_cta,
  slide3_badge, slide3_title, slide3_subtitle, slide3_description, slide3_cta,
  stats_students_label, stats_universities_label, stats_countries_label,
  stats_service_label, stats_service_value
) VALUES (
  'en',
  '🎓 Study Abroad', 'Your Future Starts Here', 'Join 50,000+ students who found their dream university with us',
  'Access top universities worldwide with personalized guidance every step of the way. From application to arrival, we''re with you.',
  'Start Your Journey',
  
  '🤖 AI-Powered', 'Meet Your AI Academic Counselor', 'Get instant personalized university recommendations',
  'Our advanced AI analyzes your profile, preferences, and goals to match you with the perfect universities and programs.',
  'Try AI Advisor',
  
  '⭐ Success Stories', 'Join Thousands of Success Stories', '98% of our students get accepted to their dream university',
  'With comprehensive support from application to visa and beyond, we ensure your study abroad journey is smooth and successful.',
  'Read Success Stories',
  
  'Students', 'Universities', 'Countries', 'Service', 'Free'
) ON CONFLICT (locale) DO NOTHING;