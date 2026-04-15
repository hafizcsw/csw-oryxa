// Services content data for service detail pages
// Bilingual support (AR/EN)
// Comprehensive content reflecting end-to-end student services from 0 to graduation

export interface ServiceFeature {
  icon: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export interface ServiceStep {
  number: number;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export interface ServiceFAQ {
  questionAr: string;
  questionEn: string;
  answerAr: string;
  answerEn: string;
}

export interface ServiceStat {
  value: string;
  labelAr: string;
  labelEn: string;
}

export interface ServiceContent {
  slug: string;
  heroTitleAr: string;
  heroTitleEn: string;
  heroDescriptionAr: string;
  heroDescriptionEn: string;
  features: ServiceFeature[];
  steps: ServiceStep[];
  faqs: ServiceFAQ[];
  ctaTextAr: string;
  ctaTextEn: string;
  stats?: ServiceStat[];
  comingSoon?: boolean;
}

export const servicesContent: Record<string, ServiceContent> = {
  accommodation: {
    slug: "accommodation",
    heroTitleAr: "خدمة السكن الطلابي",
    heroTitleEn: "Student Accommodation",
    heroDescriptionAr: "سكنك جاهز قبل وصولك - نختار لك المكان الأنسب بناءً على جامعتك وميزانيتك، ونوفر لك جولات افتراضية، عقود موثقة، ومتابعة مستمرة حتى تستقر في سكنك الجديد.",
    heroDescriptionEn: "Your home awaits before you arrive - We select the best option based on your university and budget, provide virtual tours, verified contracts, and continuous support until you settle in.",
    stats: [
      { value: "5000+", labelAr: "طالب تم إسكانهم", labelEn: "Students Housed" },
      { value: "98%", labelAr: "نسبة الرضا", labelEn: "Satisfaction Rate" },
      { value: "24/7", labelAr: "دعم متواصل", labelEn: "Continuous Support" }
    ],
    features: [
      {
        icon: "Video",
        titleAr: "جولات افتراضية",
        titleEn: "Virtual Tours",
        descriptionAr: "شاهد سكنك قبل الحجز عبر جولة فيديو مفصلة لكل غرفة ومرفق",
        descriptionEn: "View your accommodation before booking via detailed video tour of every room and facility"
      },
      {
        icon: "FileCheck",
        titleAr: "عقود موثقة",
        titleEn: "Verified Contracts",
        descriptionAr: "عقود رسمية موثقة لحماية حقوقك القانونية طوال فترة الإيجار",
        descriptionEn: "Official verified contracts to protect your legal rights throughout your lease"
      },
      {
        icon: "Wrench",
        titleAr: "دعم الصيانة",
        titleEn: "Maintenance Support",
        descriptionAr: "نتابع مشاكل السكن والصيانة نيابة عنك طوال فترة إقامتك",
        descriptionEn: "We handle housing and maintenance issues on your behalf throughout your stay"
      },
      {
        icon: "Users",
        titleAr: "مرافقة للمعاينة",
        titleEn: "In-Person Viewing",
        descriptionAr: "فريقنا يرافقك عند الوصول لمعاينة السكن والتأكد من مطابقته للوصف",
        descriptionEn: "Our team accompanies you upon arrival to view and verify the accommodation"
      },
      {
        icon: "MapPin",
        titleAr: "مواقع مميزة",
        titleEn: "Prime Locations",
        descriptionAr: "خيارات سكن قريبة من جامعتك ووسائل المواصلات والخدمات الأساسية",
        descriptionEn: "Housing options near your university, transportation, and essential services"
      }
    ],
    steps: [
      { 
        number: 1, 
        titleAr: "استشارة مجانية", 
        titleEn: "Free Consultation", 
        descriptionAr: "نفهم احتياجاتك، ميزانيتك، وموقع جامعتك لنحدد الخيارات الأنسب", 
        descriptionEn: "We understand your needs, budget, and university location to identify best options" 
      },
      { 
        number: 2, 
        titleAr: "عرض الخيارات", 
        titleEn: "Present Options", 
        descriptionAr: "نقدم لك 3-5 خيارات سكن مختارة بعناية مع صور وتفاصيل كاملة", 
        descriptionEn: "We present 3-5 carefully selected housing options with photos and full details" 
      },
      { 
        number: 3, 
        titleAr: "جولة افتراضية", 
        titleEn: "Virtual Tour", 
        descriptionAr: "شاهد السكن أونلاين عبر فيديو مباشر أو مسجل قبل اتخاذ قرارك", 
        descriptionEn: "View accommodation online via live or recorded video before making your decision" 
      },
      { 
        number: 4, 
        titleAr: "الحجز والتعاقد", 
        titleEn: "Booking & Contract", 
        descriptionAr: "نتولى إجراءات الحجز وتوقيع عقد رسمي موثق يحفظ حقوقك", 
        descriptionEn: "We handle booking procedures and sign an official verified contract protecting your rights" 
      },
      { 
        number: 5, 
        titleAr: "الاستقرار والمتابعة", 
        titleEn: "Settlement & Follow-up", 
        descriptionAr: "نرافقك لمعاينة السكن عند الوصول ونتابع معك لحل أي مشكلة", 
        descriptionEn: "We accompany you to view accommodation upon arrival and follow up to resolve any issues" 
      }
    ],
    faqs: [
      { 
        questionAr: "ماذا لو لم يعجبني السكن بعد الوصول؟", 
        questionEn: "What if I don't like the accommodation after arrival?", 
        answerAr: "نوفر لك فترة معاينة أولى، وإذا لم يتطابق السكن مع الوصف نساعدك في إيجاد بديل فوراً بدون تكاليف إضافية.", 
        answerEn: "We provide an initial viewing period, and if accommodation doesn't match description, we help find an alternative immediately at no extra cost." 
      },
      { 
        questionAr: "هل يمكنني تغيير السكن خلال السنة الدراسية؟", 
        questionEn: "Can I change accommodation during the academic year?", 
        answerAr: "نعم، نساعدك في إيجاد سكن بديل وفقاً لشروط العقد، مع التفاوض مع المالك إذا لزم الأمر.", 
        answerEn: "Yes, we help find alternative accommodation according to contract terms, negotiating with landlord if necessary." 
      },
      { 
        questionAr: "من يتعامل مع صاحب السكن في حالة المشاكل؟", 
        questionEn: "Who deals with the landlord in case of problems?", 
        answerAr: "فريقنا يتولى التواصل مع صاحب السكن نيابة عنك لحل أي مشكلة تتعلق بالصيانة أو العقد.", 
        answerEn: "Our team handles communication with landlord on your behalf to resolve any maintenance or contract issues." 
      },
      { 
        questionAr: "هل تشمل الخدمة الأثاث والفواتير؟", 
        questionEn: "Does the service include furniture and bills?", 
        answerAr: "نوفر خيارات سكن مفروشة وغير مفروشة، ونوضح لك تفاصيل الفواتير المشمولة في كل عرض.", 
        answerEn: "We offer furnished and unfurnished options, and clarify which bills are included in each offer." 
      },
      { 
        questionAr: "كيف أدفع الإيجار من بلدي؟", 
        questionEn: "How do I pay rent from my country?", 
        answerAr: "نساعدك في ترتيب طريقة الدفع الآمنة سواء تحويل بنكي أو عبر خدماتنا للتحويل المالي.", 
        answerEn: "We help arrange secure payment methods whether bank transfer or through our money transfer services." 
      },
      { 
        questionAr: "ما المستندات المطلوبة للحجز؟", 
        questionEn: "What documents are required for booking?", 
        answerAr: "جواز السفر، خطاب القبول الجامعي، وإثبات القدرة المالية (كشف حساب أو كفالة).", 
        answerEn: "Passport, university acceptance letter, and proof of financial ability (bank statement or sponsorship)." 
      }
    ],
    ctaTextAr: "احجز سكنك الآن",
    ctaTextEn: "Book Your Accommodation Now"
  },

  airport: {
    slug: "airport",
    heroTitleAr: "خدمة الاستقبال من المطار",
    heroTitleEn: "Airport Pickup Service",
    heroDescriptionAr: "لحظة وصولك هي بداية رحلتك معنا - سائق خاص يحمل لوحة باسمك، يساعدك في الأمتعة، ويوصلك مباشرة لباب سكنك مع شريحة اتصال مجانية.",
    heroDescriptionEn: "Your arrival marks the start of your journey with us - A private driver holding your name sign, luggage assistance, and direct delivery to your doorstep with a free SIM card.",
    stats: [
      { value: "10,000+", labelAr: "رحلة استقبال", labelEn: "Pickups Completed" },
      { value: "100%", labelAr: "التزام بالمواعيد", labelEn: "On-Time Rate" },
      { value: "24/7", labelAr: "متاح دائماً", labelEn: "Always Available" }
    ],
    features: [
      {
        icon: "User",
        titleAr: "لوحة اسم خاصة بك",
        titleEn: "Personal Name Sign",
        descriptionAr: "سائقك ينتظرك عند بوابة الوصول حاملاً لوحة باسمك لتتعرف عليه بسهولة",
        descriptionEn: "Your driver waits at arrival gate holding a sign with your name for easy identification"
      },
      {
        icon: "Luggage",
        titleAr: "مساعدة في الأمتعة",
        titleEn: "Luggage Assistance",
        descriptionAr: "نساعدك في حمل وترتيب أمتعتك من صالة الوصول حتى السيارة",
        descriptionEn: "We help carry and arrange your luggage from arrival hall to the vehicle"
      },
      {
        icon: "Smartphone",
        titleAr: "شريحة SIM مجانية",
        titleEn: "Free SIM Card",
        descriptionAr: "تحصل على شريحة اتصال مفعّلة لحظة وصولك للتواصل مع أهلك فوراً",
        descriptionEn: "Receive an activated SIM card upon arrival to contact family immediately"
      },
      {
        icon: "Map",
        titleAr: "معلومات المدينة",
        titleEn: "City Information",
        descriptionAr: "سائقنا يقدم لك معلومات أولية عن المدينة والأماكن المهمة",
        descriptionEn: "Our driver provides initial city information and important locations"
      },
      {
        icon: "Phone",
        titleAr: "رقم طوارئ 24/7",
        titleEn: "24/7 Emergency Line",
        descriptionAr: "رقم دعم طوارئ متاح على مدار الساعة في حالة أي مشكلة",
        descriptionEn: "Emergency support number available 24/7 in case of any issues"
      }
    ],
    steps: [
      { 
        number: 1, 
        titleAr: "أرسل تفاصيل رحلتك", 
        titleEn: "Send Flight Details", 
        descriptionAr: "شاركنا رقم الرحلة وموعد الوصول وعنوان سكنك قبل السفر", 
        descriptionEn: "Share your flight number, arrival time, and accommodation address before travel" 
      },
      { 
        number: 2, 
        titleAr: "تأكيد الحجز", 
        titleEn: "Booking Confirmation", 
        descriptionAr: "نرسل لك تأكيد الحجز مع اسم السائق ورقم هاتفه للتواصل", 
        descriptionEn: "We send booking confirmation with driver's name and phone number for contact" 
      },
      { 
        number: 3, 
        titleAr: "تتبع رحلتك", 
        titleEn: "Flight Tracking", 
        descriptionAr: "نتابع رحلتك تلقائياً ونعدل موعد الاستقبال حسب أي تأخير", 
        descriptionEn: "We automatically track your flight and adjust pickup time for any delays" 
      },
      { 
        number: 4, 
        titleAr: "الاستقبال في المطار", 
        titleEn: "Airport Pickup", 
        descriptionAr: "سائقك ينتظرك بلوحة اسمك عند بوابة الوصول ويساعدك في الأمتعة", 
        descriptionEn: "Your driver waits with name sign at arrival gate and helps with luggage" 
      },
      { 
        number: 5, 
        titleAr: "التوصيل لباب سكنك", 
        titleEn: "Door-to-Door Delivery", 
        descriptionAr: "نوصلك مباشرة لباب سكنك مع التأكد من دخولك بسلام", 
        descriptionEn: "We deliver you directly to your accommodation door ensuring safe entry" 
      }
    ],
    faqs: [
      { 
        questionAr: "ماذا لو تأخرت رحلتي؟", 
        questionEn: "What if my flight is delayed?", 
        answerAr: "نتابع رحلتك تلقائياً عبر أنظمة المطار ونعدل موعد الاستقبال بدون أي رسوم إضافية.", 
        answerEn: "We automatically track your flight through airport systems and adjust pickup time at no extra cost." 
      },
      { 
        questionAr: "ماذا لو لم أجد السائق؟", 
        questionEn: "What if I can't find the driver?", 
        answerAr: "تواصل معنا فوراً عبر رقم الطوارئ أو واتساب وسنرشدك لموقع السائق بالتحديد.", 
        answerEn: "Contact us immediately via emergency number or WhatsApp and we'll guide you to driver's exact location." 
      },
      { 
        questionAr: "هل يمكنني حجز رحلة العودة للمطار؟", 
        questionEn: "Can I book return trip to airport?", 
        answerAr: "نعم، نوفر خدمة التوصيل للمطار عند السفر بنفس الجودة والاحترافية.", 
        answerEn: "Yes, we provide airport drop-off service when traveling with same quality and professionalism." 
      },
      { 
        questionAr: "هل الخدمة متاحة في جميع المطارات؟", 
        questionEn: "Is service available at all airports?", 
        answerAr: "نغطي جميع المطارات الرئيسية في الدول التي نعمل بها، تواصل معنا لتأكيد التغطية.", 
        answerEn: "We cover all major airports in countries we operate in, contact us to confirm coverage." 
      },
      { 
        questionAr: "كم عدد الأمتعة المسموح بها؟", 
        questionEn: "How much luggage is allowed?", 
        answerAr: "السيارة العادية تتسع لحقيبتين كبيرتين + حقيبة يد. للأمتعة الأكثر نوفر سيارة أكبر.", 
        answerEn: "Standard car fits 2 large suitcases + carry-on. For more luggage, we provide larger vehicle." 
      }
    ],
    ctaTextAr: "احجز استقبالك الآن",
    ctaTextEn: "Book Your Pickup Now"
  },

  bank: {
    slug: "bank",
    heroTitleAr: "فتح حساب بنكي",
    heroTitleEn: "Bank Account Opening",
    heroDescriptionAr: "افتح حسابك البنكي من بلدك قبل السفر - بطاقتك جاهزة تصلك للمنزل، نساعدك في التفعيل واستخدام التطبيق البنكي مع رسوم شفافة بدون مفاجآت.",
    heroDescriptionEn: "Open your bank account from home before travel - Your card ready, delivered to your door, we help with activation and app usage with transparent fees and no surprises.",
    stats: [
      { value: "3000+", labelAr: "حساب تم فتحه", labelEn: "Accounts Opened" },
      { value: "5", labelAr: "بنوك شريكة", labelEn: "Partner Banks" },
      { value: "0", labelAr: "رسوم خفية", labelEn: "Hidden Fees" }
    ],
    features: [
      {
        icon: "Globe",
        titleAr: "فتح الحساب عن بُعد",
        titleEn: "Remote Account Opening",
        descriptionAr: "أكمل جميع الإجراءات من بلدك دون الحاجة لزيارة البنك شخصياً",
        descriptionEn: "Complete all procedures from your country without visiting the bank in person"
      },
      {
        icon: "CreditCard",
        titleAr: "بطاقة تصلك للمنزل",
        titleEn: "Card Delivered Home",
        descriptionAr: "بطاقتك البنكية تُشحن لعنوانك قبل السفر جاهزة للاستخدام",
        descriptionEn: "Your bank card is shipped to your address before travel, ready to use"
      },
      {
        icon: "Headphones",
        titleAr: "دعم في التفعيل",
        titleEn: "Activation Support",
        descriptionAr: "نرافقك خطوة بخطوة في تفعيل الحساب والبطاقة والتطبيق",
        descriptionEn: "We guide you step by step in activating account, card, and app"
      },
      {
        icon: "Smartphone",
        titleAr: "شرح التطبيق البنكي",
        titleEn: "Banking App Tutorial",
        descriptionAr: "نعلمك استخدام التطبيق البنكي للتحويلات والدفع وإدارة حسابك",
        descriptionEn: "We teach you to use banking app for transfers, payments, and account management"
      },
      {
        icon: "FileText",
        titleAr: "رسوم شفافة",
        titleEn: "Transparent Fees",
        descriptionAr: "نوضح لك جميع الرسوم مسبقاً بدون أي تكاليف مخفية أو مفاجآت",
        descriptionEn: "We clarify all fees upfront with no hidden costs or surprises"
      }
    ],
    steps: [
      { 
        number: 1, 
        titleAr: "استشارة واختيار البنك", 
        titleEn: "Consultation & Bank Selection", 
        descriptionAr: "نفهم احتياجاتك ونرشح لك البنك الأنسب لبلد دراستك", 
        descriptionEn: "We understand your needs and recommend the best bank for your study country" 
      },
      { 
        number: 2, 
        titleAr: "تعبئة البيانات", 
        titleEn: "Fill Application", 
        descriptionAr: "نساعدك في تعبئة طلب فتح الحساب بالمعلومات الصحيحة", 
        descriptionEn: "We help you fill the account opening application with correct information" 
      },
      { 
        number: 3, 
        titleAr: "رفع المستندات", 
        titleEn: "Upload Documents", 
        descriptionAr: "ارفع جواز السفر وإثبات العنوان وخطاب القبول الجامعي", 
        descriptionEn: "Upload passport, proof of address, and university acceptance letter" 
      },
      { 
        number: 4, 
        titleAr: "مراجعة وموافقة", 
        titleEn: "Review & Approval", 
        descriptionAr: "البنك يراجع طلبك خلال 3-7 أيام عمل ونتابع معك الحالة", 
        descriptionEn: "Bank reviews your application within 3-7 business days, we track status" 
      },
      { 
        number: 5, 
        titleAr: "استلام البطاقة والتفعيل", 
        titleEn: "Receive Card & Activate", 
        descriptionAr: "تصلك البطاقة لعنوانك ونساعدك في التفعيل واستخدام التطبيق", 
        descriptionEn: "Card arrives at your address, we help with activation and app usage" 
      }
    ],
    faqs: [
      { 
        questionAr: "ما البنوك المتاحة؟", 
        questionEn: "Which banks are available?", 
        answerAr: "نتعامل مع بنوك دولية موثوقة تختلف حسب بلد الدراسة، مثل Wise, Revolut، والبنوك المحلية.", 
        answerEn: "We work with trusted international banks varying by study country, like Wise, Revolut, and local banks." 
      },
      { 
        questionAr: "هل هناك رسوم شهرية على الحساب؟", 
        questionEn: "Are there monthly account fees?", 
        answerAr: "تختلف الرسوم حسب البنك ونوع الحساب، نوضح لك التفاصيل الكاملة قبل فتح الحساب.", 
        answerEn: "Fees vary by bank and account type, we clarify full details before opening account." 
      },
      { 
        questionAr: "كم يستغرق فتح الحساب؟", 
        questionEn: "How long does account opening take?", 
        answerAr: "عادة من 3-10 أيام عمل حسب البنك ومتطلبات التحقق.", 
        answerEn: "Usually 3-10 business days depending on bank and verification requirements." 
      },
      { 
        questionAr: "هل يمكنني استخدام البطاقة قبل السفر؟", 
        questionEn: "Can I use the card before travel?", 
        answerAr: "نعم، معظم البطاقات تعمل دولياً ويمكنك استخدامها للشراء أونلاين فور التفعيل.", 
        answerEn: "Yes, most cards work internationally and you can use them for online purchases once activated." 
      },
      { 
        questionAr: "ماذا لو رُفض طلبي؟", 
        questionEn: "What if my application is rejected?", 
        answerAr: "نراجع أسباب الرفض معك ونساعدك في تقديم طلب جديد أو اختيار بنك بديل.", 
        answerEn: "We review rejection reasons with you and help submit new application or choose alternative bank." 
      }
    ],
    ctaTextAr: "افتح حسابك الآن",
    ctaTextEn: "Open Your Account Now"
  },

  course: {
    slug: "course",
    heroTitleAr: "الدورات التحضيرية",
    heroTitleEn: "Preparatory Courses",
    heroDescriptionAr: "جهّز نفسك للنجاح - دورات لغة وتحضير للاختبارات الدولية (IELTS, TOEFL) مع متابعة شخصية، خطة دراسية مخصصة، وضمان الدرجة المطلوبة.",
    heroDescriptionEn: "Prepare for success - Language and international exam prep courses (IELTS, TOEFL) with personal follow-up, customized study plan, and target score guarantee.",
    stats: [
      { value: "2000+", labelAr: "طالب تخرّج", labelEn: "Graduates" },
      { value: "95%", labelAr: "نسبة النجاح", labelEn: "Success Rate" },
      { value: "50+", labelAr: "مدرب معتمد", labelEn: "Certified Trainers" }
    ],
    features: [
      {
        icon: "ClipboardCheck",
        titleAr: "اختبار تحديد المستوى",
        titleEn: "Level Assessment Test",
        descriptionAr: "اختبار مجاني لتحديد مستواك الحالي ووضع خطة دراسية مناسبة",
        descriptionEn: "Free test to assess your current level and create appropriate study plan"
      },
      {
        icon: "Target",
        titleAr: "خطة دراسية مخصصة",
        titleEn: "Customized Study Plan",
        descriptionAr: "خطة دراسية مصممة خصيصاً لأهدافك ومستواك ووقتك المتاح",
        descriptionEn: "Study plan designed specifically for your goals, level, and available time"
      },
      {
        icon: "UserCheck",
        titleAr: "جلسات تقوية فردية",
        titleEn: "Individual Support Sessions",
        descriptionAr: "جلسات خاصة مع المدرب لتقوية نقاط الضعف والإجابة على أسئلتك",
        descriptionEn: "Private sessions with trainer to strengthen weak areas and answer questions"
      },
      {
        icon: "Monitor",
        titleAr: "محاكاة الاختبار الحقيقي",
        titleEn: "Real Exam Simulation",
        descriptionAr: "اختبارات تجريبية بنفس ظروف الاختبار الحقيقي للتدرب والاستعداد",
        descriptionEn: "Practice tests under real exam conditions for training and preparation"
      },
      {
        icon: "Award",
        titleAr: "ضمان الدرجة",
        titleEn: "Score Guarantee",
        descriptionAr: "نضمن لك تحقيق الدرجة المطلوبة أو إعادة الدورة مجاناً",
        descriptionEn: "We guarantee you achieve target score or retake course for free"
      }
    ],
    steps: [
      { 
        number: 1, 
        titleAr: "اختبار تحديد المستوى", 
        titleEn: "Level Assessment", 
        descriptionAr: "اختبار مجاني لتحديد مستواك الحالي والدرجة المستهدفة", 
        descriptionEn: "Free test to determine your current level and target score" 
      },
      { 
        number: 2, 
        titleAr: "اختيار الدورة والخطة", 
        titleEn: "Choose Course & Plan", 
        descriptionAr: "نرشح لك الدورة المناسبة ونصمم خطة دراسية مخصصة", 
        descriptionEn: "We recommend suitable course and design customized study plan" 
      },
      { 
        number: 3, 
        titleAr: "التسجيل والبدء", 
        titleEn: "Register & Start", 
        descriptionAr: "أكمل التسجيل وابدأ رحلة التعلم مع مدربين محترفين", 
        descriptionEn: "Complete registration and begin learning journey with professional trainers" 
      },
      { 
        number: 4, 
        titleAr: "الدراسة والمتابعة", 
        titleEn: "Study & Follow-up", 
        descriptionAr: "ادرس وفق الخطة مع متابعة أسبوعية وجلسات تقوية", 
        descriptionEn: "Study according to plan with weekly follow-up and support sessions" 
      },
      { 
        number: 5, 
        titleAr: "الاختبار والشهادة", 
        titleEn: "Exam & Certificate", 
        descriptionAr: "نساعدك في حجز الاختبار والحصول على شهادتك المعتمدة", 
        descriptionEn: "We help book exam and obtain your certified certificate" 
      }
    ],
    faqs: [
      { 
        questionAr: "ما الدورات المتاحة؟", 
        questionEn: "What courses are available?", 
        answerAr: "IELTS, TOEFL, SAT، دورات لغة روسية، تركية، ألمانية، وغيرها حسب بلد الدراسة.", 
        answerEn: "IELTS, TOEFL, SAT, Russian, Turkish, German language courses, and more based on study country." 
      },
      { 
        questionAr: "كم مدة الدورة؟", 
        questionEn: "How long is the course?", 
        answerAr: "تختلف من 4 أسابيع للدورات المكثفة إلى 6 أشهر للدورات الشاملة.", 
        answerEn: "Varies from 4 weeks for intensive to 6 months for comprehensive courses." 
      },
      { 
        questionAr: "هل الدورة أونلاين أم حضورية؟", 
        questionEn: "Is the course online or in-person?", 
        answerAr: "نوفر كلا الخيارين: دورات أونلاين مباشرة أو حضورية في مراكزنا.", 
        answerEn: "We offer both: live online courses or in-person at our centers." 
      },
      { 
        questionAr: "ماذا لو لم أحقق الدرجة المطلوبة؟", 
        questionEn: "What if I don't achieve target score?", 
        answerAr: "نقدم ضمان الدرجة - إذا لم تحقق الدرجة المطلوبة يمكنك إعادة الدورة مجاناً.", 
        answerEn: "We offer score guarantee - if you don't achieve target score, you can retake course for free." 
      },
      { 
        questionAr: "هل تشمل الدورة مواد دراسية؟", 
        questionEn: "Does course include study materials?", 
        answerAr: "نعم، جميع المواد الدراسية والاختبارات التجريبية مشمولة في سعر الدورة.", 
        answerEn: "Yes, all study materials and practice tests are included in course price." 
      },
      { 
        questionAr: "هل يمكنني حجز موعد الاختبار الرسمي عبركم؟", 
        questionEn: "Can I book official exam through you?", 
        answerAr: "نعم، نساعدك في حجز موعد الاختبار الرسمي في أقرب مركز معتمد.", 
        answerEn: "Yes, we help book official exam at nearest certified center." 
      }
    ],
    ctaTextAr: "سجل في دورتك الآن",
    ctaTextEn: "Enroll in Your Course Now"
  },

  health: {
    slug: "health",
    heroTitleAr: "التأمين الصحي",
    heroTitleEn: "Health Insurance",
    heroDescriptionAr: "صحتك أولويتنا - تأمين صحي شامل معتمد 100% للفيزا، مع بطاقة تأمين رقمية فورية، تغطية الأسنان والعيون، وخط ساخن بالعربي 24/7.",
    heroDescriptionEn: "Your health is our priority - Comprehensive health insurance 100% visa-approved, with instant digital insurance card, dental and vision coverage, and 24/7 Arabic hotline.",
    stats: [
      { value: "100%", labelAr: "مقبول للفيزا", labelEn: "Visa Approved" },
      { value: "8000+", labelAr: "طالب مؤمّن", labelEn: "Insured Students" },
      { value: "24/7", labelAr: "دعم بالعربي", labelEn: "Arabic Support" }
    ],
    features: [
      {
        icon: "CheckCircle",
        titleAr: "مقبول 100% للفيزا",
        titleEn: "100% Visa Approved",
        descriptionAr: "تأمين معتمد ومقبول في جميع سفارات الدول التي نخدمها",
        descriptionEn: "Certified insurance accepted by all embassies of countries we serve"
      },
      {
        icon: "CreditCard",
        titleAr: "بطاقة تأمين رقمية فورية",
        titleEn: "Instant Digital Card",
        descriptionAr: "احصل على بطاقة تأمينك الرقمية فوراً بعد الدفع لاستخدامها في أي مستشفى",
        descriptionEn: "Get your digital insurance card instantly after payment for use at any hospital"
      },
      {
        icon: "Smile",
        titleAr: "تغطية الأسنان والعيون",
        titleEn: "Dental & Vision Coverage",
        descriptionAr: "تغطية شاملة تشمل علاجات الأسنان وفحوصات ونظارات العيون",
        descriptionEn: "Comprehensive coverage including dental treatments, eye exams, and glasses"
      },
      {
        icon: "Building2",
        titleAr: "مستشفيات بدون دفع مقدم",
        titleEn: "Hospitals Without Upfront Payment",
        descriptionAr: "شبكة مستشفيات شريكة تعالجك مباشرة بدون دفع من جيبك",
        descriptionEn: "Partner hospital network treats you directly without out-of-pocket payment"
      },
      {
        icon: "Headphones",
        titleAr: "خط ساخن بالعربي 24/7",
        titleEn: "24/7 Arabic Hotline",
        descriptionAr: "فريق دعم يتحدث العربية متاح على مدار الساعة للمساعدة والاستشارات",
        descriptionEn: "Arabic-speaking support team available 24/7 for help and consultations"
      }
    ],
    steps: [
      { 
        number: 1, 
        titleAr: "استشارة واختيار الخطة", 
        titleEn: "Consultation & Plan Selection", 
        descriptionAr: "نفهم احتياجاتك ونرشح لك خطة التأمين المناسبة لبلد دراستك", 
        descriptionEn: "We understand your needs and recommend suitable insurance plan for your study country" 
      },
      { 
        number: 2, 
        titleAr: "تعبئة البيانات", 
        titleEn: "Fill Application", 
        descriptionAr: "نساعدك في تعبئة طلب التأمين بالمعلومات الصحيحة والمستندات المطلوبة", 
        descriptionEn: "We help fill insurance application with correct information and required documents" 
      },
      { 
        number: 3, 
        titleAr: "الدفع والتفعيل الفوري", 
        titleEn: "Payment & Instant Activation", 
        descriptionAr: "أكمل الدفع واحصل على بطاقة تأمينك الرقمية فوراً", 
        descriptionEn: "Complete payment and receive your digital insurance card instantly" 
      },
      { 
        number: 4, 
        titleAr: "استلام وثيقة الفيزا", 
        titleEn: "Receive Visa Document", 
        descriptionAr: "نرسل لك وثيقة التأمين الرسمية المطلوبة لطلب الفيزا", 
        descriptionEn: "We send you official insurance document required for visa application" 
      },
      { 
        number: 5, 
        titleAr: "دعم مستمر طوال دراستك", 
        titleEn: "Continuous Support Throughout Studies", 
        descriptionAr: "نتابع معك طوال فترة دراستك ونساعدك في أي مطالبات أو استفسارات", 
        descriptionEn: "We follow up throughout your studies and help with any claims or inquiries" 
      }
    ],
    faqs: [
      { 
        questionAr: "ما الذي يغطيه التأمين؟", 
        questionEn: "What does insurance cover?", 
        answerAr: "زيارات الطبيب، الطوارئ، الأدوية، العمليات، الأسنان، العيون، والعلاج النفسي حسب الخطة.", 
        answerEn: "Doctor visits, emergencies, medications, surgeries, dental, vision, and mental health based on plan." 
      },
      { 
        questionAr: "هل التأمين مقبول في جميع السفارات؟", 
        questionEn: "Is insurance accepted by all embassies?", 
        answerAr: "نعم، تأميننا معتمد ومقبول 100% في سفارات جميع الدول التي نخدمها.", 
        answerEn: "Yes, our insurance is certified and 100% accepted by embassies of all countries we serve." 
      },
      { 
        questionAr: "كيف أستخدم التأمين في المستشفى؟", 
        questionEn: "How do I use insurance at hospital?", 
        answerAr: "أظهر بطاقة التأمين الرقمية للمستشفى الشريك ويتم العلاج مباشرة بدون دفع.", 
        answerEn: "Show digital insurance card to partner hospital and receive treatment directly without payment." 
      },
      { 
        questionAr: "ماذا لو احتجت علاج في مستشفى غير شريك؟", 
        questionEn: "What if I need treatment at non-partner hospital?", 
        answerAr: "ادفع واحتفظ بالفواتير ونساعدك في تقديم مطالبة استرداد خلال أسبوع.", 
        answerEn: "Pay and keep receipts, we help submit refund claim within a week." 
      },
      { 
        questionAr: "هل يمكنني تجديد التأمين سنوياً؟", 
        questionEn: "Can I renew insurance annually?", 
        answerAr: "نعم، نتواصل معك قبل انتهاء التأمين لتجديده بسهولة واستمرارية التغطية.", 
        answerEn: "Yes, we contact you before expiry to renew easily and maintain continuous coverage." 
      },
      { 
        questionAr: "هل يغطي الحالات السابقة للتأمين؟", 
        questionEn: "Does it cover pre-existing conditions?", 
        answerAr: "تختلف التغطية حسب الخطة، بعض الخطط تغطي الحالات السابقة بعد فترة انتظار.", 
        answerEn: "Coverage varies by plan, some plans cover pre-existing conditions after waiting period." 
      }
    ],
    ctaTextAr: "احصل على تأمينك الآن",
    ctaTextEn: "Get Your Insurance Now"
  },

  sim: {
    slug: "sim",
    heroTitleAr: "شريحة الاتصال والإنترنت",
    heroTitleEn: "SIM & Internet",
    heroDescriptionAr: "اتصل بأهلك لحظة وصولك - شريحة جاهزة بباقة إنترنت سخية، تُسلّم في المطار أو قبل السفر، مع رقم محلي ثابت وشحن سهل عبر التطبيق.",
    heroDescriptionEn: "Connect with family the moment you arrive - Ready SIM with generous data, delivered at airport or before travel, with permanent local number and easy app recharge.",
    stats: [
      { value: "15,000+", labelAr: "شريحة تم توزيعها", labelEn: "SIMs Distributed" },
      { value: "50%", labelAr: "أقل من السوق", labelEn: "Below Market Price" },
      { value: "5G", labelAr: "سرعة الإنترنت", labelEn: "Internet Speed" }
    ],
    features: [
      {
        icon: "Plane",
        titleAr: "تسليم في المطار",
        titleEn: "Airport Delivery",
        descriptionAr: "استلم شريحتك مفعّلة لحظة وصولك للمطار مع خدمة الاستقبال",
        descriptionEn: "Receive your activated SIM upon airport arrival with pickup service"
      },
      {
        icon: "Phone",
        titleAr: "رقم محلي ثابت",
        titleEn: "Permanent Local Number",
        descriptionAr: "رقم محلي خاص بك يبقى معك طوال فترة دراستك",
        descriptionEn: "Your own local number that stays with you throughout your studies"
      },
      {
        icon: "Wallet",
        titleAr: "باقات بأسعار طلابية",
        titleEn: "Student-Priced Packages",
        descriptionAr: "باقات شهرية خاصة بأسعار مخفضة للطلاب فقط",
        descriptionEn: "Special monthly packages at reduced prices for students only"
      },
      {
        icon: "MessageCircle",
        titleAr: "واتساب مجاني",
        titleEn: "Free WhatsApp",
        descriptionAr: "واتساب وتطبيقات التواصل الاجتماعي مجانية بدون خصم من الباقة",
        descriptionEn: "WhatsApp and social media apps free without deducting from package"
      },
      {
        icon: "Smartphone",
        titleAr: "شحن سهل عبر التطبيق",
        titleEn: "Easy App Recharge",
        descriptionAr: "اشحن باقتك بسهولة من التطبيق بأي بطاقة دفع دولية",
        descriptionEn: "Easily recharge via app with any international payment card"
      }
    ],
    steps: [
      { 
        number: 1, 
        titleAr: "اختر الباقة المناسبة", 
        titleEn: "Choose Suitable Package", 
        descriptionAr: "اختر باقة البيانات والمكالمات المناسبة لاحتياجاتك", 
        descriptionEn: "Choose data and calls package suitable for your needs" 
      },
      { 
        number: 2, 
        titleAr: "أدخل بياناتك", 
        titleEn: "Enter Your Details", 
        descriptionAr: "أدخل اسمك ورقم رحلتك أو عنوان التوصيل", 
        descriptionEn: "Enter your name and flight number or delivery address" 
      },
      { 
        number: 3, 
        titleAr: "أكمل الدفع", 
        titleEn: "Complete Payment", 
        descriptionAr: "ادفع أونلاين بأي بطاقة دولية أو عبر خدماتنا", 
        descriptionEn: "Pay online with any international card or through our services" 
      },
      { 
        number: 4, 
        titleAr: "استلم شريحتك", 
        titleEn: "Receive Your SIM", 
        descriptionAr: "استلم الشريحة في المطار من سائقنا أو بالبريد قبل السفر", 
        descriptionEn: "Receive SIM at airport from our driver or by mail before travel" 
      },
      { 
        number: 5, 
        titleAr: "فعّل واستخدم فوراً", 
        titleEn: "Activate & Use Immediately", 
        descriptionAr: "ركّب الشريحة وابدأ الاستخدام فوراً بدون أي إعدادات معقدة", 
        descriptionEn: "Insert SIM and start using immediately without complex settings" 
      }
    ],
    faqs: [
      { 
        questionAr: "متى أستلم الشريحة؟", 
        questionEn: "When do I receive the SIM?", 
        answerAr: "يمكن استلامها في المطار مع خدمة الاستقبال، أو توصيلها لعنوانك قبل السفر.", 
        answerEn: "Can be received at airport with pickup service, or delivered to your address before travel." 
      },
      { 
        questionAr: "كم حجم البيانات في الباقة؟", 
        questionEn: "How much data is in the package?", 
        answerAr: "تختلف الباقات من 10GB إلى unlimited حسب اختيارك وبلد الدراسة.", 
        answerEn: "Packages vary from 10GB to unlimited based on your choice and study country." 
      },
      { 
        questionAr: "هل يمكنني الاتصال لبلدي؟", 
        questionEn: "Can I call my country?", 
        answerAr: "نعم، الباقات تشمل دقائق للاتصال الدولي، ويمكنك استخدام واتساب مجاناً.", 
        answerEn: "Yes, packages include international calling minutes, and you can use WhatsApp for free." 
      },
      { 
        questionAr: "كيف أشحن الباقة بعد انتهائها؟", 
        questionEn: "How do I recharge after package ends?", 
        answerAr: "اشحن بسهولة من تطبيق الشركة بأي بطاقة دفع دولية أو عبر خدماتنا.", 
        answerEn: "Easily recharge from carrier app with any international payment card or through our services." 
      },
      { 
        questionAr: "هل الشريحة تعمل فوراً؟", 
        questionEn: "Does the SIM work immediately?", 
        answerAr: "نعم، الشريحة مفعّلة ومشحونة جاهزة للاستخدام فور تركيبها.", 
        answerEn: "Yes, SIM is activated and recharged, ready to use immediately upon insertion." 
      }
    ],
    ctaTextAr: "اطلب شريحتك الآن",
    ctaTextEn: "Order Your SIM Now"
  },

  visa: {
    slug: "visa",
    heroTitleAr: "خدمات التأشيرة",
    heroTitleEn: "Visa Services",
    heroDescriptionAr: "تأشيرتك مضمونة معنا - نتولى كل الإجراءات من الألف للياء: مراجعة المستندات، الترجمة، حجز موعد السفارة، التحضير للمقابلة، ومتابعة يومية حتى ختم جوازك.",
    heroDescriptionEn: "Your visa guaranteed with us - We handle all procedures from A to Z: document review, translation, embassy appointment, interview prep, and daily tracking until passport stamped.",
    stats: [
      { value: "98%", labelAr: "نسبة النجاح", labelEn: "Success Rate" },
      { value: "12,000+", labelAr: "تأشيرة ناجحة", labelEn: "Successful Visas" },
      { value: "15+", labelAr: "دولة نخدمها", labelEn: "Countries Served" }
    ],
    features: [
      {
        icon: "FileSearch",
        titleAr: "مراجعة مجانية للمستندات",
        titleEn: "Free Document Review",
        descriptionAr: "نراجع جميع مستنداتك مجاناً ونرشدك للنواقص قبل التقديم",
        descriptionEn: "We review all your documents for free and guide you on missing items before applying"
      },
      {
        icon: "Languages",
        titleAr: "ترجمة معتمدة",
        titleEn: "Certified Translation",
        descriptionAr: "خدمة ترجمة معتمدة لجميع مستنداتك بأسعار خاصة للطلاب",
        descriptionEn: "Certified translation service for all documents at special student prices"
      },
      {
        icon: "Calendar",
        titleAr: "حجز موعد السفارة",
        titleEn: "Embassy Appointment",
        descriptionAr: "نحجز لك أقرب موعد متاح في السفارة أو مركز التأشيرات",
        descriptionEn: "We book nearest available appointment at embassy or visa center"
      },
      {
        icon: "MessageSquare",
        titleAr: "تحضير للمقابلة",
        titleEn: "Interview Preparation",
        descriptionAr: "جلسات تدريب على أسئلة المقابلة الشائعة وكيفية الإجابة بثقة",
        descriptionEn: "Training sessions on common interview questions and how to answer confidently"
      },
      {
        icon: "RefreshCw",
        titleAr: "إعادة تقديم مجاني",
        titleEn: "Free Resubmission",
        descriptionAr: "في حالة الرفض النادرة، نعيد تقديم طلبك مجاناً مع معالجة الأسباب",
        descriptionEn: "In rare rejection cases, we resubmit your application free with addressed reasons"
      }
    ],
    steps: [
      { 
        number: 1, 
        titleAr: "استشارة مجانية", 
        titleEn: "Free Consultation", 
        descriptionAr: "تحدث مع خبرائنا لفهم متطلبات تأشيرة بلد دراستك", 
        descriptionEn: "Talk to our experts to understand visa requirements for your study country" 
      },
      { 
        number: 2, 
        titleAr: "مراجعة وتجهيز المستندات", 
        titleEn: "Document Review & Preparation", 
        descriptionAr: "نراجع مستنداتك ونساعدك في تجهيز الناقص والترجمة المطلوبة", 
        descriptionEn: "We review documents and help prepare missing items and required translations" 
      },
      { 
        number: 3, 
        titleAr: "حجز الموعد والتحضير", 
        titleEn: "Appointment & Preparation", 
        descriptionAr: "نحجز موعد السفارة ونجهزك للمقابلة بجلسات تدريبية", 
        descriptionEn: "We book embassy appointment and prepare you for interview with training sessions" 
      },
      { 
        number: 4, 
        titleAr: "تقديم الطلب", 
        titleEn: "Submit Application", 
        descriptionAr: "نرافقك للسفارة أو نقدم طلبك نيابة عنك حسب متطلبات البلد", 
        descriptionEn: "We accompany you to embassy or submit on your behalf based on country requirements" 
      },
      { 
        number: 5, 
        titleAr: "متابعة وختم الجواز", 
        titleEn: "Tracking & Passport Stamp", 
        descriptionAr: "متابعة يومية لطلبك حتى الموافقة وختم جوازك بالتأشيرة", 
        descriptionEn: "Daily tracking of your application until approval and passport stamped with visa" 
      }
    ],
    faqs: [
      { 
        questionAr: "كم تستغرق إجراءات التأشيرة؟", 
        questionEn: "How long does visa processing take?", 
        answerAr: "تختلف حسب البلد: روسيا 2-3 أسابيع، تركيا 1-2 أسبوع، أوروبا 4-8 أسابيع.", 
        answerEn: "Varies by country: Russia 2-3 weeks, Turkey 1-2 weeks, Europe 4-8 weeks." 
      },
      { 
        questionAr: "ماذا لو رُفض طلبي؟", 
        questionEn: "What if my application is rejected?", 
        answerAr: "نراجع أسباب الرفض معك، نعالجها، ونعيد التقديم مجاناً مع تحسين الملف.", 
        answerEn: "We review rejection reasons, address them, and resubmit free with improved file." 
      },
      { 
        questionAr: "هل تضمنون الحصول على التأشيرة؟", 
        questionEn: "Do you guarantee visa approval?", 
        answerAr: "نسبة نجاحنا 98%، ونضمن تقديم ملف مثالي. القرار النهائي للسفارة.", 
        answerEn: "Our success rate is 98%, we guarantee a perfect file. Final decision is embassy's." 
      },
      { 
        questionAr: "هل تحتاجون جواز سفري الأصلي؟", 
        questionEn: "Do you need my original passport?", 
        answerAr: "نحتاج الجواز الأصلي فقط عند التقديم للسفارة، باقي الإجراءات بالنسخ.", 
        answerEn: "We need original passport only when submitting to embassy, rest of procedures with copies." 
      },
      { 
        questionAr: "هل يمكنني تتبع حالة طلبي؟", 
        questionEn: "Can I track my application status?", 
        answerAr: "نعم، نرسل لك تحديثات يومية على واتساب بحالة طلبك وأي تطورات.", 
        answerEn: "Yes, we send daily WhatsApp updates on your application status and any developments." 
      },
      { 
        questionAr: "ما المستندات الأساسية المطلوبة؟", 
        questionEn: "What are the basic required documents?", 
        answerAr: "جواز السفر، صور شخصية، خطاب القبول، التأمين الصحي، وإثبات مالي. تختلف حسب البلد.", 
        answerEn: "Passport, photos, acceptance letter, health insurance, and financial proof. Varies by country." 
      }
    ],
    ctaTextAr: "ابدأ طلب تأشيرتك الآن",
    ctaTextEn: "Start Your Visa Application Now"
  },

  transfer_soon: {
    slug: "transfer_soon",
    heroTitleAr: "تحويل الأموال الدولي",
    heroTitleEn: "International Money Transfer",
    heroDescriptionAr: "حوّل أموالك بسعر الصرف الحقيقي بدون رسوم خفية أو وسطاء. تحويل آمن ومشفر يصل لحسابك في بلد الدراسة خلال 24-48 ساعة. تابع حوالتك لحظة بلحظة مع دعم على مدار الساعة.",
    heroDescriptionEn: "Transfer your money at the real exchange rate with no hidden fees or intermediaries. Secure and encrypted transfer that reaches your account in your study country within 24-48 hours. Track your transfer in real-time with 24/7 support.",
    stats: [
      { value: "0%", labelAr: "رسوم خفية", labelEn: "Hidden Fees" },
      { value: "24h", labelAr: "وقت الوصول", labelEn: "Arrival Time" },
      { value: "15+", labelAr: "عملة مدعومة", labelEn: "Currencies" }
    ],
    features: [
      {
        icon: "Zap",
        titleAr: "تحويل فوري وسريع",
        titleEn: "Fast & Instant Transfer",
        descriptionAr: "تحويل الأموال يصل حسابك خلال 24-48 ساعة فقط، أسرع من البنوك التقليدية بمراحل",
        descriptionEn: "Money transfer reaches your account within 24-48 hours, much faster than traditional banks"
      },
      {
        icon: "Percent",
        titleAr: "أسعار صرف حقيقية",
        titleEn: "Real Exchange Rates",
        descriptionAr: "سعر السوق الحقيقي بدون هامش ربح إضافي، وفّر أموالك مع كل تحويل",
        descriptionEn: "Real market rate with no extra markup, save money with every transfer"
      },
      {
        icon: "MapPin",
        titleAr: "تتبع لحظي للحوالة",
        titleEn: "Real-Time Tracking",
        descriptionAr: "تابع حوالتك من لحظة الإرسال حتى الوصول لحساب المستلم مع إشعارات فورية",
        descriptionEn: "Track your transfer from sending to arrival at recipient's account with instant notifications"
      },
      {
        icon: "Shield",
        titleAr: "آمن ومشفر بالكامل",
        titleEn: "Fully Secure & Encrypted",
        descriptionAr: "تشفير بنكي متقدم يحمي أموالك وبياناتك الشخصية بأعلى معايير الأمان",
        descriptionEn: "Advanced bank-grade encryption protects your money and personal data with highest security standards"
      },
      {
        icon: "FileText",
        titleAr: "شفافية كاملة بدون مفاجآت",
        titleEn: "Full Transparency, No Surprises",
        descriptionAr: "جميع الرسوم وسعر الصرف معلنة مسبقاً قبل التحويل، ما تراه هو ما تدفعه",
        descriptionEn: "All fees and exchange rate disclosed upfront before transfer, what you see is what you pay"
      }
    ],
    steps: [
      { 
        number: 1, 
        titleAr: "اختر المبلغ والعملة", 
        titleEn: "Choose Amount & Currency", 
        descriptionAr: "حدد المبلغ الذي تريد إرساله واختر العملة المستهدفة من بين 15+ عملة", 
        descriptionEn: "Select the amount you want to send and choose target currency from 15+ currencies" 
      },
      { 
        number: 2, 
        titleAr: "أضف بيانات المستلم", 
        titleEn: "Add Recipient Details", 
        descriptionAr: "أدخل اسم المستفيد ورقم حسابه البنكي أو بيانات الدفع الإلكتروني", 
        descriptionEn: "Enter beneficiary name and bank account number or e-payment details" 
      },
      { 
        number: 3, 
        titleAr: "راجع التفاصيل", 
        titleEn: "Review Details", 
        descriptionAr: "تحقق من سعر الصرف والرسوم ومبلغ الوصول النهائي قبل التأكيد", 
        descriptionEn: "Verify exchange rate, fees, and final arrival amount before confirming" 
      },
      { 
        number: 4, 
        titleAr: "أكمل الدفع", 
        titleEn: "Complete Payment", 
        descriptionAr: "ادفع بالبطاقة الائتمانية أو التحويل البنكي أو المحفظة الإلكترونية", 
        descriptionEn: "Pay by credit card, bank transfer, or e-wallet" 
      },
      { 
        number: 5, 
        titleAr: "تتبع وتأكيد الوصول", 
        titleEn: "Track & Confirm Arrival", 
        descriptionAr: "تابع حوالتك لحظة بلحظة واستلم إشعار فوري عند وصول الأموال", 
        descriptionEn: "Track your transfer in real-time and receive instant notification when money arrives" 
      }
    ],
    faqs: [
      { 
        questionAr: "كم تستغرق الحوالة للوصول؟", 
        questionEn: "How long does the transfer take to arrive?", 
        answerAr: "معظم التحويلات تصل خلال 24-48 ساعة. بعض الدول قد تستغرق 2-3 أيام عمل حسب البنك المستقبل.", 
        answerEn: "Most transfers arrive within 24-48 hours. Some countries may take 2-3 business days depending on receiving bank." 
      },
      { 
        questionAr: "ما هي الرسوم والعمولات؟", 
        questionEn: "What are the fees and commissions?", 
        answerAr: "رسومنا شفافة ومعلنة مسبقاً. لا توجد رسوم خفية أو عمولات إضافية. تدفع فقط ما تراه.", 
        answerEn: "Our fees are transparent and disclosed upfront. No hidden fees or additional commissions. You only pay what you see." 
      },
      { 
        questionAr: "هل سعر الصرف ثابت أم متغير؟", 
        questionEn: "Is the exchange rate fixed or variable?", 
        answerAr: "سعر الصرف يتم تثبيته لحظة تأكيد التحويل ولا يتغير. ما تراه هو ما يصل المستلم.", 
        answerEn: "Exchange rate is locked at the moment of transfer confirmation and doesn't change. What you see is what recipient gets." 
      },
      { 
        questionAr: "ما العملات والدول المدعومة؟", 
        questionEn: "What currencies and countries are supported?", 
        answerAr: "ندعم أكثر من 15 عملة تشمل: روسيا، تركيا، مصر، الأردن، المغرب، أوروبا، بريطانيا، أمريكا والمزيد.", 
        answerEn: "We support over 15 currencies including: Russia, Turkey, Egypt, Jordan, Morocco, Europe, UK, USA and more." 
      },
      { 
        questionAr: "كيف أتتبع حوالتي؟", 
        questionEn: "How do I track my transfer?", 
        answerAr: "تستلم رقم متابعة فوري بعد التحويل، وتصلك إشعارات واتساب بكل تحديث حتى وصول الأموال.", 
        answerEn: "You receive an instant tracking number after transfer, and get WhatsApp notifications for every update until money arrives." 
      },
      { 
        questionAr: "هل أموالي آمنة؟", 
        questionEn: "Is my money safe?", 
        answerAr: "نستخدم تشفير بنكي متقدم ونحتفظ بأموالك في حسابات منفصلة محمية. معتمدون من الجهات التنظيمية.", 
        answerEn: "We use advanced bank-grade encryption and hold your money in separate protected accounts. Licensed by regulatory authorities." 
      }
    ],
    ctaTextAr: "أبلغني عند الإطلاق",
    ctaTextEn: "Notify Me at Launch",
    comingSoon: false
  },

  translation_russia: {
    slug: "translation_russia",
    heroTitleAr: "الترجمة السريعة لروسيا",
    heroTitleEn: "Fast Translation for Russia",
    heroDescriptionAr: "ترجمة معتمدة لجميع وثائقك الرسمية للغة الروسية - شهادات، جوازات، كشوف درجات وأكثر. ترجمة احترافية موثقة خلال 24-48 ساعة مع توصيل مباشر لسفارة أو جامعة.",
    heroDescriptionEn: "Certified translation of all your official documents to Russian - certificates, passports, transcripts and more. Professional notarized translation within 24-48 hours with direct delivery to embassy or university.",
    stats: [
      { value: "10,000+", labelAr: "وثيقة مترجمة", labelEn: "Documents Translated" },
      { value: "24h", labelAr: "ترجمة سريعة", labelEn: "Fast Turnaround" },
      { value: "100%", labelAr: "قبول مضمون", labelEn: "Acceptance Guaranteed" }
    ],
    features: [
      {
        icon: "FileText",
        titleAr: "ترجمة معتمدة رسمياً",
        titleEn: "Officially Certified Translation",
        descriptionAr: "ترجمة موثقة ومعتمدة من مترجمين محلفين معترف بهم لدى السفارات والجامعات الروسية",
        descriptionEn: "Notarized translation certified by sworn translators recognized by Russian embassies and universities"
      },
      {
        icon: "Clock",
        titleAr: "سرعة في التنفيذ",
        titleEn: "Fast Execution",
        descriptionAr: "نترجم وثائقك خلال 24-48 ساعة مع خيار الترجمة العاجلة في نفس اليوم",
        descriptionEn: "We translate your documents within 24-48 hours with same-day urgent translation option"
      },
      {
        icon: "Shield",
        titleAr: "ضمان القبول",
        titleEn: "Acceptance Guarantee",
        descriptionAr: "نضمن قبول ترجماتنا في جميع الجامعات والسفارات الروسية أو استرداد المبلغ",
        descriptionEn: "We guarantee acceptance of our translations at all Russian universities and embassies or refund"
      },
      {
        icon: "Globe",
        titleAr: "تغطية شاملة",
        titleEn: "Comprehensive Coverage",
        descriptionAr: "نترجم جميع أنواع الوثائق: شهادات، جوازات، كشوف درجات، وثائق طبية وقانونية",
        descriptionEn: "We translate all document types: certificates, passports, transcripts, medical and legal documents"
      },
      {
        icon: "Zap",
        titleAr: "توصيل مباشر",
        titleEn: "Direct Delivery",
        descriptionAr: "نوصل الوثائق المترجمة مباشرة للسفارة أو الجامعة نيابة عنك",
        descriptionEn: "We deliver translated documents directly to embassy or university on your behalf"
      }
    ],
    steps: [
      { 
        number: 1, 
        titleAr: "إرسال الوثائق", 
        titleEn: "Send Documents", 
        descriptionAr: "أرسل صور واضحة من وثائقك عبر واتساب أو البريد الإلكتروني", 
        descriptionEn: "Send clear photos of your documents via WhatsApp or email" 
      },
      { 
        number: 2, 
        titleAr: "عرض السعر", 
        titleEn: "Price Quote", 
        descriptionAr: "تحصل على عرض سعر فوري شامل التوثيق والتوصيل", 
        descriptionEn: "Get instant price quote including notarization and delivery" 
      },
      { 
        number: 3, 
        titleAr: "الترجمة والتوثيق", 
        titleEn: "Translation & Notarization", 
        descriptionAr: "مترجمون محلفون يترجمون وثائقك مع التوثيق الرسمي", 
        descriptionEn: "Sworn translators translate your documents with official notarization" 
      },
      { 
        number: 4, 
        titleAr: "المراجعة والتدقيق", 
        titleEn: "Review & Proofreading", 
        descriptionAr: "مراجعة دقيقة لضمان صحة الترجمة ومطابقتها للأصل", 
        descriptionEn: "Thorough review to ensure translation accuracy and original matching" 
      },
      { 
        number: 5, 
        titleAr: "التسليم أو التوصيل", 
        titleEn: "Delivery", 
        descriptionAr: "استلام الوثائق أو توصيلها للسفارة/الجامعة مباشرة", 
        descriptionEn: "Receive documents or have them delivered to embassy/university directly" 
      }
    ],
    faqs: [
      { 
        questionAr: "ما الوثائق التي تحتاج ترجمة للدراسة في روسيا؟", 
        questionEn: "What documents need translation for studying in Russia?", 
        answerAr: "شهادة الثانوية، كشف الدرجات، شهادة الميلاد، جواز السفر، الشهادات الصحية، وأي وثائق إضافية تطلبها الجامعة.", 
        answerEn: "High school certificate, transcripts, birth certificate, passport, health certificates, and any additional documents requested by university." 
      },
      { 
        questionAr: "كم تستغرق الترجمة؟", 
        questionEn: "How long does translation take?", 
        answerAr: "الترجمة العادية 24-48 ساعة، والترجمة العاجلة في نفس اليوم مقابل رسوم إضافية.", 
        answerEn: "Standard translation takes 24-48 hours, urgent same-day translation available for additional fee." 
      },
      { 
        questionAr: "هل الترجمة مقبولة في جميع الجامعات الروسية؟", 
        questionEn: "Is translation accepted at all Russian universities?", 
        answerAr: "نعم، ترجماتنا معتمدة ومقبولة في جميع الجامعات الروسية والسفارة الروسية.", 
        answerEn: "Yes, our translations are certified and accepted at all Russian universities and Russian embassy." 
      },
      { 
        questionAr: "هل يمكنكم توصيل الوثائق للسفارة مباشرة؟", 
        questionEn: "Can you deliver documents to embassy directly?", 
        answerAr: "نعم، نوفر خدمة التوصيل المباشر للسفارة أو الجامعة وتقديم الأوراق نيابة عنك.", 
        answerEn: "Yes, we provide direct delivery to embassy or university and submit papers on your behalf." 
      },
      { 
        questionAr: "ما تكلفة ترجمة الوثائق؟", 
        questionEn: "What is the cost of document translation?", 
        answerAr: "تختلف التكلفة حسب نوع الوثيقة وعدد الصفحات. تواصل معنا للحصول على عرض سعر مجاني.", 
        answerEn: "Cost varies by document type and page count. Contact us for a free price quote." 
      }
    ],
    ctaTextAr: "اطلب ترجمتك الآن",
    ctaTextEn: "Request Translation Now"
  }
};

// Map icon keys to route paths for consistency
export const serviceRouteMap: Record<string, string> = {
  accommodation: "/services/accommodation",
  airport: "/services/airport",
  bank: "/services/bank",
  course: "/services/course",
  health: "/services/health",
  sim: "/services/sim",
  visa: "/services/visa",
  transfer_soon: "/services/transfer_soon",
  translation_russia: "/services/translation_russia"
};
