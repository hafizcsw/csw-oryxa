/**
 * Comprehensive country translations for all 196 countries in 12 languages
 * Languages: ar, en, fr, ru, es, zh, hi, bn, pt, ja, de, ko
 */

export type SupportedLanguage = 'ar' | 'en' | 'fr' | 'ru' | 'es' | 'zh' | 'hi' | 'bn' | 'pt' | 'ja' | 'de' | 'ko';

type CountryTranslation = Record<SupportedLanguage, string>;

export const COUNTRY_NAMES: Record<string, CountryTranslation> = {
  // United Arab Emirates
  "ae": {
    ar: "الإمارات العربية المتحدة",
    en: "United Arab Emirates",
    fr: "Émirats Arabes Unis",
    ru: "Объединённые Арабские Эмираты",
    es: "Emiratos Árabes Unidos",
    zh: "阿拉伯联合酋长国",
    hi: "संयुक्त अरब अमीरात",
    bn: "সংযুক্ত আরব আমিরাত",
    pt: "Emirados Árabes Unidos",
    ja: "アラブ首長国連邦",
    de: "Vereinigte Arabische Emirate",
    ko: "아랍에미리트"
  },
  // Armenia
  "am": {
    ar: "أرمينيا",
    en: "Armenia",
    fr: "Arménie",
    ru: "Армения",
    es: "Armenia",
    zh: "亚美尼亚",
    hi: "आर्मेनिया",
    bn: "আর্মেনিয়া",
    pt: "Arménia",
    ja: "アルメニア",
    de: "Armenien",
    ko: "아르메니아"
  },
  // Argentina
  "argentina": {
    ar: "الأرجنتين",
    en: "Argentina",
    fr: "Argentine",
    ru: "Аргентина",
    es: "Argentina",
    zh: "阿根廷",
    hi: "अर्जेंटीना",
    bn: "আর্জেন্টিনা",
    pt: "Argentina",
    ja: "アルゼンチン",
    de: "Argentinien",
    ko: "아르헨티나"
  },
  // Austria
  "at": {
    ar: "النمسا",
    en: "Austria",
    fr: "Autriche",
    ru: "Австрия",
    es: "Austria",
    zh: "奥地利",
    hi: "ऑस्ट्रिया",
    bn: "অস্ট্রিয়া",
    pt: "Áustria",
    ja: "オーストリア",
    de: "Österreich",
    ko: "오스트리아"
  },
  // Australia
  "au": {
    ar: "أستراليا",
    en: "Australia",
    fr: "Australie",
    ru: "Австралия",
    es: "Australia",
    zh: "澳大利亚",
    hi: "ऑस्ट्रेलिया",
    bn: "অস্ট্রেলিয়া",
    pt: "Austrália",
    ja: "オーストラリア",
    de: "Australien",
    ko: "호주"
  },
  // Azerbaijan
  "az": {
    ar: "أذربيجان",
    en: "Azerbaijan",
    fr: "Azerbaïdjan",
    ru: "Азербайджан",
    es: "Azerbaiyán",
    zh: "阿塞拜疆",
    hi: "अज़रबैजान",
    bn: "আজারবাইজান",
    pt: "Azerbaijão",
    ja: "アゼルバイジャン",
    de: "Aserbaidschan",
    ko: "아제르바이잔"
  },
  // Bangladesh
  "bd": {
    ar: "بنغلاديش",
    en: "Bangladesh",
    fr: "Bangladesh",
    ru: "Бангладеш",
    es: "Bangladés",
    zh: "孟加拉国",
    hi: "बांग्लादेश",
    bn: "বাংলাদেশ",
    pt: "Bangladesh",
    ja: "バングラデシュ",
    de: "Bangladesch",
    ko: "방글라데시"
  },
  // Belgium
  "belgium": {
    ar: "بلجيكا",
    en: "Belgium",
    fr: "Belgique",
    ru: "Бельгия",
    es: "Bélgica",
    zh: "比利时",
    hi: "बेल्जियम",
    bn: "বেলজিয়াম",
    pt: "Bélgica",
    ja: "ベルギー",
    de: "Belgien",
    ko: "벨기에"
  },
  // Bulgaria
  "bg": {
    ar: "بلغاريا",
    en: "Bulgaria",
    fr: "Bulgarie",
    ru: "Болгария",
    es: "Bulgaria",
    zh: "保加利亚",
    hi: "बुल्गारिया",
    bn: "বুলগেরিয়া",
    pt: "Bulgária",
    ja: "ブルガリア",
    de: "Bulgarien",
    ko: "불가리아"
  },
  // Brazil
  "br": {
    ar: "البرازيل",
    en: "Brazil",
    fr: "Brésil",
    ru: "Бразилия",
    es: "Brasil",
    zh: "巴西",
    hi: "ब्राज़ील",
    bn: "ব্রাজিল",
    pt: "Brasil",
    ja: "ブラジル",
    de: "Brasilien",
    ko: "브라질"
  },
  // Belarus
  "by": {
    ar: "بيلاروسيا",
    en: "Belarus",
    fr: "Biélorussie",
    ru: "Беларусь",
    es: "Bielorrusia",
    zh: "白俄罗斯",
    hi: "बेलारूस",
    bn: "বেলারুশ",
    pt: "Bielorrússia",
    ja: "ベラルーシ",
    de: "Belarus",
    ko: "벨라루스"
  },
  // Canada
  "ca": {
    ar: "كندا",
    en: "Canada",
    fr: "Canada",
    ru: "Канада",
    es: "Canadá",
    zh: "加拿大",
    hi: "कनाडा",
    bn: "কানাডা",
    pt: "Canadá",
    ja: "カナダ",
    de: "Kanada",
    ko: "캐나다"
  },
  // Chile
  "cl": {
    ar: "تشيلي",
    en: "Chile",
    fr: "Chili",
    ru: "Чили",
    es: "Chile",
    zh: "智利",
    hi: "चिली",
    bn: "চিলি",
    pt: "Chile",
    ja: "チリ",
    de: "Chile",
    ko: "칠레"
  },
  // China
  "cn": {
    ar: "الصين",
    en: "China",
    fr: "Chine",
    ru: "Китай",
    es: "China",
    zh: "中国",
    hi: "चीन",
    bn: "চীন",
    pt: "China",
    ja: "中国",
    de: "China",
    ko: "중국"
  },
  // Colombia
  "co": {
    ar: "كولومبيا",
    en: "Colombia",
    fr: "Colombie",
    ru: "Колумбия",
    es: "Colombia",
    zh: "哥伦比亚",
    hi: "कोलंबिया",
    bn: "কলম্বিয়া",
    pt: "Colômbia",
    ja: "コロンビア",
    de: "Kolumbien",
    ko: "콜롬비아"
  },
  // Costa Rica
  "cr": {
    ar: "كوستاريكا",
    en: "Costa Rica",
    fr: "Costa Rica",
    ru: "Коста-Рика",
    es: "Costa Rica",
    zh: "哥斯达黎加",
    hi: "कोस्टा रिका",
    bn: "কোস্টা রিকা",
    pt: "Costa Rica",
    ja: "コスタリカ",
    de: "Costa Rica",
    ko: "코스타리카"
  },
  // Cyprus
  "cy": {
    ar: "قبرص",
    en: "Cyprus",
    fr: "Chypre",
    ru: "Кипр",
    es: "Chipre",
    zh: "塞浦路斯",
    hi: "साइप्रस",
    bn: "সাইপ্রাস",
    pt: "Chipre",
    ja: "キプロス",
    de: "Zypern",
    ko: "키프로스"
  },
  // Czech Republic
  "cz": {
    ar: "التشيك",
    en: "Czech Republic",
    fr: "République Tchèque",
    ru: "Чехия",
    es: "República Checa",
    zh: "捷克",
    hi: "चेक गणराज्य",
    bn: "চেক প্রজাতন্ত্র",
    pt: "República Tcheca",
    ja: "チェコ",
    de: "Tschechien",
    ko: "체코"
  },
  // Denmark
  "denmark": {
    ar: "الدنمارك",
    en: "Denmark",
    fr: "Danemark",
    ru: "Дания",
    es: "Dinamarca",
    zh: "丹麦",
    hi: "डेनमार्क",
    bn: "ডেনমার্ক",
    pt: "Dinamarca",
    ja: "デンマーク",
    de: "Dänemark",
    ko: "덴마크"
  },
  // Ecuador
  "ec": {
    ar: "الإكوادور",
    en: "Ecuador",
    fr: "Équateur",
    ru: "Эквадор",
    es: "Ecuador",
    zh: "厄瓜多尔",
    hi: "इक्वाडोर",
    bn: "ইকুয়েডর",
    pt: "Equador",
    ja: "エクアドル",
    de: "Ecuador",
    ko: "에콰도르"
  },
  // Estonia
  "ee": {
    ar: "إستونيا",
    en: "Estonia",
    fr: "Estonie",
    ru: "Эстония",
    es: "Estonia",
    zh: "爱沙尼亚",
    hi: "एस्टोनिया",
    bn: "এস্তোনিয়া",
    pt: "Estónia",
    ja: "エストニア",
    de: "Estland",
    ko: "에스토니아"
  },
  // Egypt
  "eg": {
    ar: "مصر",
    en: "Egypt",
    fr: "Égypte",
    ru: "Египет",
    es: "Egipto",
    zh: "埃及",
    hi: "मिस्र",
    bn: "মিশর",
    pt: "Egito",
    ja: "エジプト",
    de: "Ägypten",
    ko: "이집트"
  },
  // Finland
  "fi": {
    ar: "فنلندا",
    en: "Finland",
    fr: "Finlande",
    ru: "Финляндия",
    es: "Finlandia",
    zh: "芬兰",
    hi: "फ़िनलैंड",
    bn: "ফিনল্যান্ড",
    pt: "Finlândia",
    ja: "フィンランド",
    de: "Finnland",
    ko: "핀란드"
  },
  // France
  "france": {
    ar: "فرنسا",
    en: "France",
    fr: "France",
    ru: "Франция",
    es: "Francia",
    zh: "法国",
    hi: "फ़्रांस",
    bn: "ফ্রান্স",
    pt: "França",
    ja: "フランス",
    de: "Frankreich",
    ko: "프랑스"
  },
  // Georgia
  "ge": {
    ar: "جورجيا",
    en: "Georgia",
    fr: "Géorgie",
    ru: "Грузия",
    es: "Georgia",
    zh: "格鲁吉亚",
    hi: "जॉर्जिया",
    bn: "জর্জিয়া",
    pt: "Geórgia",
    ja: "ジョージア",
    de: "Georgien",
    ko: "조지아"
  },
  // Germany
  "germany": {
    ar: "ألمانيا",
    en: "Germany",
    fr: "Allemagne",
    ru: "Германия",
    es: "Alemania",
    zh: "德国",
    hi: "जर्मनी",
    bn: "জার্মানি",
    pt: "Alemanha",
    ja: "ドイツ",
    de: "Deutschland",
    ko: "독일"
  },
  // Ghana
  "gh": {
    ar: "غانا",
    en: "Ghana",
    fr: "Ghana",
    ru: "Гана",
    es: "Ghana",
    zh: "加纳",
    hi: "घाना",
    bn: "ঘানা",
    pt: "Gana",
    ja: "ガーナ",
    de: "Ghana",
    ko: "가나"
  },
  // Greece
  "gr": {
    ar: "اليونان",
    en: "Greece",
    fr: "Grèce",
    ru: "Греция",
    es: "Grecia",
    zh: "希腊",
    hi: "यूनान",
    bn: "গ্রীস",
    pt: "Grécia",
    ja: "ギリシャ",
    de: "Griechenland",
    ko: "그리스"
  },
  // Hong Kong
  "hong-kong": {
    ar: "هونغ كونغ",
    en: "Hong Kong",
    fr: "Hong Kong",
    ru: "Гонконг",
    es: "Hong Kong",
    zh: "香港",
    hi: "हांगकांग",
    bn: "হংকং",
    pt: "Hong Kong",
    ja: "香港",
    de: "Hongkong",
    ko: "홍콩"
  },
  // Croatia
  "hr": {
    ar: "كرواتيا",
    en: "Croatia",
    fr: "Croatie",
    ru: "Хорватия",
    es: "Croacia",
    zh: "克罗地亚",
    hi: "क्रोएशिया",
    bn: "ক্রোয়েশিয়া",
    pt: "Croácia",
    ja: "クロアチア",
    de: "Kroatien",
    ko: "크로아티아"
  },
  // Hungary
  "hu": {
    ar: "المجر",
    en: "Hungary",
    fr: "Hongrie",
    ru: "Венгрия",
    es: "Hungría",
    zh: "匈牙利",
    hi: "हंगरी",
    bn: "হাঙ্গেরি",
    pt: "Hungria",
    ja: "ハンガリー",
    de: "Ungarn",
    ko: "헝가리"
  },
  // Indonesia
  "id": {
    ar: "إندونيسيا",
    en: "Indonesia",
    fr: "Indonésie",
    ru: "Индонезия",
    es: "Indonesia",
    zh: "印度尼西亚",
    hi: "इंडोनेशिया",
    bn: "ইন্দোনেশিয়া",
    pt: "Indonésia",
    ja: "インドネシア",
    de: "Indonesien",
    ko: "인도네시아"
  },
  // Palestine
  "il": {
    ar: "فلسطين",
    en: "Palestine",
    fr: "Palestine",
    ru: "Палестина",
    es: "Palestina",
    zh: "巴勒斯坦",
    hi: "फ़िलिस्तीन",
    bn: "ফিলিস্তিন",
    pt: "Palestina",
    ja: "パレスチナ",
    de: "Palästina",
    ko: "팔레스타인"
  },
  // India
  "in": {
    ar: "الهند",
    en: "India",
    fr: "Inde",
    ru: "Индия",
    es: "India",
    zh: "印度",
    hi: "भारत",
    bn: "ভারত",
    pt: "Índia",
    ja: "インド",
    de: "Indien",
    ko: "인도"
  },
  // Iran
  "ir": {
    ar: "إيران",
    en: "Iran",
    fr: "Iran",
    ru: "Иран",
    es: "Irán",
    zh: "伊朗",
    hi: "ईरान",
    bn: "ইরান",
    pt: "Irã",
    ja: "イラン",
    de: "Iran",
    ko: "이란"
  },
  // Ireland
  "ireland": {
    ar: "أيرلندا",
    en: "Ireland",
    fr: "Irlande",
    ru: "Ирландия",
    es: "Irlanda",
    zh: "爱尔兰",
    hi: "आयरलैंड",
    bn: "আয়ারল্যান্ড",
    pt: "Irlanda",
    ja: "アイルランド",
    de: "Irland",
    ko: "아일랜드"
  },
  // Iceland
  "is": {
    ar: "آيسلندا",
    en: "Iceland",
    fr: "Islande",
    ru: "Исландия",
    es: "Islandia",
    zh: "冰岛",
    hi: "आइसलैंड",
    bn: "আইসল্যান্ড",
    pt: "Islândia",
    ja: "アイスランド",
    de: "Island",
    ko: "아이슬란드"
  },
  // Italy
  "italy": {
    ar: "إيطاليا",
    en: "Italy",
    fr: "Italie",
    ru: "Италия",
    es: "Italia",
    zh: "意大利",
    hi: "इटली",
    bn: "ইতালি",
    pt: "Itália",
    ja: "イタリア",
    de: "Italien",
    ko: "이탈리아"
  },
  // Japan
  "japan": {
    ar: "اليابان",
    en: "Japan",
    fr: "Japon",
    ru: "Япония",
    es: "Japón",
    zh: "日本",
    hi: "जापान",
    bn: "জাপান",
    pt: "Japão",
    ja: "日本",
    de: "Japan",
    ko: "일본"
  },
  // Jordan
  "jo": {
    ar: "الأردن",
    en: "Jordan",
    fr: "Jordanie",
    ru: "Иордания",
    es: "Jordania",
    zh: "约旦",
    hi: "जॉर्डन",
    bn: "জর্ডান",
    pt: "Jordânia",
    ja: "ヨルダン",
    de: "Jordanien",
    ko: "요르단"
  },
  // Kenya
  "ke": {
    ar: "كينيا",
    en: "Kenya",
    fr: "Kenya",
    ru: "Кения",
    es: "Kenia",
    zh: "肯尼亚",
    hi: "केन्या",
    bn: "কেনিয়া",
    pt: "Quénia",
    ja: "ケニア",
    de: "Kenia",
    ko: "케냐"
  },
  // Kuwait
  "kw": {
    ar: "الكويت",
    en: "Kuwait",
    fr: "Koweït",
    ru: "Кувейт",
    es: "Kuwait",
    zh: "科威特",
    hi: "कुवैत",
    bn: "কুয়েত",
    pt: "Kuwait",
    ja: "クウェート",
    de: "Kuwait",
    ko: "쿠웨이트"
  },
  // Kazakhstan
  "kz": {
    ar: "كازاخستان",
    en: "Kazakhstan",
    fr: "Kazakhstan",
    ru: "Казахстан",
    es: "Kazajistán",
    zh: "哈萨克斯坦",
    hi: "कज़ाख़स्तान",
    bn: "কাজাখস্তান",
    pt: "Cazaquistão",
    ja: "カザフスタン",
    de: "Kasachstan",
    ko: "카자흐스탄"
  },
  // Lebanon
  "lb": {
    ar: "لبنان",
    en: "Lebanon",
    fr: "Liban",
    ru: "Ливан",
    es: "Líbano",
    zh: "黎巴嫩",
    hi: "लेबनान",
    bn: "লেবানন",
    pt: "Líbano",
    ja: "レバノン",
    de: "Libanon",
    ko: "레바논"
  },
  // Sri Lanka
  "lk": {
    ar: "سريلانكا",
    en: "Sri Lanka",
    fr: "Sri Lanka",
    ru: "Шри-Ланка",
    es: "Sri Lanka",
    zh: "斯里兰卡",
    hi: "श्रीलंका",
    bn: "শ্রীলঙ্কা",
    pt: "Sri Lanka",
    ja: "スリランカ",
    de: "Sri Lanka",
    ko: "스리랑카"
  },
  // Lithuania
  "lt": {
    ar: "ليتوانيا",
    en: "Lithuania",
    fr: "Lituanie",
    ru: "Литва",
    es: "Lituania",
    zh: "立陶宛",
    hi: "लिथुआनिया",
    bn: "লিথুয়ানিয়া",
    pt: "Lituânia",
    ja: "リトアニア",
    de: "Litauen",
    ko: "리투아니아"
  },
  // Luxembourg
  "lu": {
    ar: "لوكسمبورغ",
    en: "Luxembourg",
    fr: "Luxembourg",
    ru: "Люксембург",
    es: "Luxemburgo",
    zh: "卢森堡",
    hi: "लक्ज़मबर्ग",
    bn: "লুক্সেমবার্গ",
    pt: "Luxemburgo",
    ja: "ルクセンブルク",
    de: "Luxemburg",
    ko: "룩셈부르크"
  },
  // Latvia
  "lv": {
    ar: "لاتفيا",
    en: "Latvia",
    fr: "Lettonie",
    ru: "Латвия",
    es: "Letonia",
    zh: "拉脱维亚",
    hi: "लातविया",
    bn: "লাতভিয়া",
    pt: "Letónia",
    ja: "ラトビア",
    de: "Lettland",
    ko: "라트비아"
  },
  // Morocco
  "ma": {
    ar: "المغرب",
    en: "Morocco",
    fr: "Maroc",
    ru: "Марокко",
    es: "Marruecos",
    zh: "摩洛哥",
    hi: "मोरक्को",
    bn: "মরক্কো",
    pt: "Marrocos",
    ja: "モロッコ",
    de: "Marokko",
    ko: "모로코"
  },
  // Malaysia
  "malaysia": {
    ar: "ماليزيا",
    en: "Malaysia",
    fr: "Malaisie",
    ru: "Малайзия",
    es: "Malasia",
    zh: "马来西亚",
    hi: "मलेशिया",
    bn: "মালয়েশিয়া",
    pt: "Malásia",
    ja: "マレーシア",
    de: "Malaysia",
    ko: "말레이시아"
  },
  // Malta
  "mt": {
    ar: "مالطا",
    en: "Malta",
    fr: "Malte",
    ru: "Мальта",
    es: "Malta",
    zh: "马耳他",
    hi: "माल्टा",
    bn: "মাল্টা",
    pt: "Malta",
    ja: "マルタ",
    de: "Malta",
    ko: "몰타"
  },
  // Mexico
  "mx": {
    ar: "المكسيك",
    en: "Mexico",
    fr: "Mexique",
    ru: "Мексика",
    es: "México",
    zh: "墨西哥",
    hi: "मेक्सिको",
    bn: "মেক্সিকো",
    pt: "México",
    ja: "メキシコ",
    de: "Mexiko",
    ko: "멕시코"
  },
  // Netherlands
  "netherlands": {
    ar: "هولندا",
    en: "Netherlands",
    fr: "Pays-Bas",
    ru: "Нидерланды",
    es: "Países Bajos",
    zh: "荷兰",
    hi: "नीदरलैंड",
    bn: "নেদারল্যান্ডস",
    pt: "Países Baixos",
    ja: "オランダ",
    de: "Niederlande",
    ko: "네덜란드"
  },
  // New Zealand
  "new-zealand": {
    ar: "نيوزيلندا",
    en: "New Zealand",
    fr: "Nouvelle-Zélande",
    ru: "Новая Зеландия",
    es: "Nueva Zelanda",
    zh: "新西兰",
    hi: "न्यूज़ीलैंड",
    bn: "নিউজিল্যান্ড",
    pt: "Nova Zelândia",
    ja: "ニュージーランド",
    de: "Neuseeland",
    ko: "뉴질랜드"
  },
  // Nigeria
  "ng": {
    ar: "نيجيريا",
    en: "Nigeria",
    fr: "Nigéria",
    ru: "Нигерия",
    es: "Nigeria",
    zh: "尼日利亚",
    hi: "नाइजीरिया",
    bn: "নাইজেরিয়া",
    pt: "Nigéria",
    ja: "ナイジェリア",
    de: "Nigeria",
    ko: "나이지리아"
  },
  // Norway
  "no": {
    ar: "النرويج",
    en: "Norway",
    fr: "Norvège",
    ru: "Норвегия",
    es: "Noruega",
    zh: "挪威",
    hi: "नॉर्वे",
    bn: "নরওয়ে",
    pt: "Noruega",
    ja: "ノルウェー",
    de: "Norwegen",
    ko: "노르웨이"
  },
  // Nepal
  "np": {
    ar: "نيبال",
    en: "Nepal",
    fr: "Népal",
    ru: "Непал",
    es: "Nepal",
    zh: "尼泊尔",
    hi: "नेपाल",
    bn: "নেপাল",
    pt: "Nepal",
    ja: "ネパール",
    de: "Nepal",
    ko: "네팔"
  },
  // Peru
  "pe": {
    ar: "بيرو",
    en: "Peru",
    fr: "Pérou",
    ru: "Перу",
    es: "Perú",
    zh: "秘鲁",
    hi: "पेरू",
    bn: "পেরু",
    pt: "Peru",
    ja: "ペルー",
    de: "Peru",
    ko: "페루"
  },
  // Philippines
  "ph": {
    ar: "الفلبين",
    en: "Philippines",
    fr: "Philippines",
    ru: "Филиппины",
    es: "Filipinas",
    zh: "菲律宾",
    hi: "फिलीपींस",
    bn: "ফিলিপাইন",
    pt: "Filipinas",
    ja: "フィリピン",
    de: "Philippinen",
    ko: "필리핀"
  },
  // Pakistan
  "pk": {
    ar: "باكستان",
    en: "Pakistan",
    fr: "Pakistan",
    ru: "Пакистан",
    es: "Pakistán",
    zh: "巴基斯坦",
    hi: "पाकिस्तान",
    bn: "পাকিস্তান",
    pt: "Paquistão",
    ja: "パキスタン",
    de: "Pakistan",
    ko: "파키스탄"
  },
  // Poland
  "pl": {
    ar: "بولندا",
    en: "Poland",
    fr: "Pologne",
    ru: "Польша",
    es: "Polonia",
    zh: "波兰",
    hi: "पोलैंड",
    bn: "পোল্যান্ড",
    pt: "Polónia",
    ja: "ポーランド",
    de: "Polen",
    ko: "폴란드"
  },
  // Portugal
  "pt": {
    ar: "البرتغال",
    en: "Portugal",
    fr: "Portugal",
    ru: "Португалия",
    es: "Portugal",
    zh: "葡萄牙",
    hi: "पुर्तगाल",
    bn: "পর্তুগাল",
    pt: "Portugal",
    ja: "ポルトガル",
    de: "Portugal",
    ko: "포르투갈"
  },
  // Qatar
  "qa": {
    ar: "قطر",
    en: "Qatar",
    fr: "Qatar",
    ru: "Катар",
    es: "Catar",
    zh: "卡塔尔",
    hi: "क़तर",
    bn: "কাতার",
    pt: "Catar",
    ja: "カタール",
    de: "Katar",
    ko: "카타르"
  },
  // Romania
  "ro": {
    ar: "رومانيا",
    en: "Romania",
    fr: "Roumanie",
    ru: "Румыния",
    es: "Rumania",
    zh: "罗马尼亚",
    hi: "रोमानिया",
    bn: "রোমানিয়া",
    pt: "Roménia",
    ja: "ルーマニア",
    de: "Rumänien",
    ko: "루마니아"
  },
  // Serbia
  "rs": {
    ar: "صربيا",
    en: "Serbia",
    fr: "Serbie",
    ru: "Сербия",
    es: "Serbia",
    zh: "塞尔维亚",
    hi: "सर्बिया",
    bn: "সার্বিয়া",
    pt: "Sérvia",
    ja: "セルビア",
    de: "Serbien",
    ko: "세르비아"
  },
  // Russia
  "russia": {
    ar: "روسيا",
    en: "Russia",
    fr: "Russie",
    ru: "Россия",
    es: "Rusia",
    zh: "俄罗斯",
    hi: "रूस",
    bn: "রাশিয়া",
    pt: "Rússia",
    ja: "ロシア",
    de: "Russland",
    ko: "러시아"
  },
  // Saudi Arabia
  "sa": {
    ar: "المملكة العربية السعودية",
    en: "Saudi Arabia",
    fr: "Arabie Saoudite",
    ru: "Саудовская Аравия",
    es: "Arabia Saudita",
    zh: "沙特阿拉伯",
    hi: "सऊदी अरब",
    bn: "সৌদি আরব",
    pt: "Arábia Saudita",
    ja: "サウジアラビア",
    de: "Saudi-Arabien",
    ko: "사우디아라비아"
  },
  // Slovenia
  "si": {
    ar: "سلوفينيا",
    en: "Slovenia",
    fr: "Slovénie",
    ru: "Словения",
    es: "Eslovenia",
    zh: "斯洛文尼亚",
    hi: "स्लोवेनिया",
    bn: "স্লোভেনিয়া",
    pt: "Eslovénia",
    ja: "スロベニア",
    de: "Slowenien",
    ko: "슬로베니아"
  },
  // Singapore
  "singapore": {
    ar: "سنغافورة",
    en: "Singapore",
    fr: "Singapour",
    ru: "Сингапур",
    es: "Singapur",
    zh: "新加坡",
    hi: "सिंगापुर",
    bn: "সিঙ্গাপুর",
    pt: "Singapura",
    ja: "シンガポール",
    de: "Singapur",
    ko: "싱가포르"
  },
  // South Korea
  "south-korea": {
    ar: "كوريا الجنوبية",
    en: "South Korea",
    fr: "Corée du Sud",
    ru: "Южная Корея",
    es: "Corea del Sur",
    zh: "韩国",
    hi: "दक्षिण कोरिया",
    bn: "দক্ষিণ কোরিয়া",
    pt: "Coreia do Sul",
    ja: "韓国",
    de: "Südkorea",
    ko: "대한민국"
  },
  // Spain
  "spain": {
    ar: "إسبانيا",
    en: "Spain",
    fr: "Espagne",
    ru: "Испания",
    es: "España",
    zh: "西班牙",
    hi: "स्पेन",
    bn: "স্পেন",
    pt: "Espanha",
    ja: "スペイン",
    de: "Spanien",
    ko: "스페인"
  },
  // Sweden
  "sweden": {
    ar: "السويد",
    en: "Sweden",
    fr: "Suède",
    ru: "Швеция",
    es: "Suecia",
    zh: "瑞典",
    hi: "स्वीडन",
    bn: "সুইডেন",
    pt: "Suécia",
    ja: "スウェーデン",
    de: "Schweden",
    ko: "스웨덴"
  },
  // Switzerland
  "switzerland": {
    ar: "سويسرا",
    en: "Switzerland",
    fr: "Suisse",
    ru: "Швейцария",
    es: "Suiza",
    zh: "瑞士",
    hi: "स्विट्ज़रलैंड",
    bn: "সুইজারল্যান্ড",
    pt: "Suíça",
    ja: "スイス",
    de: "Schweiz",
    ko: "스위스"
  },
  // Taiwan
  "taiwan": {
    ar: "تايوان",
    en: "Taiwan",
    fr: "Taïwan",
    ru: "Тайвань",
    es: "Taiwán",
    zh: "台湾",
    hi: "ताइवान",
    bn: "তাইওয়ান",
    pt: "Taiwan",
    ja: "台湾",
    de: "Taiwan",
    ko: "대만"
  },
  // Thailand
  "th": {
    ar: "تايلاند",
    en: "Thailand",
    fr: "Thaïlande",
    ru: "Таиланд",
    es: "Tailandia",
    zh: "泰国",
    hi: "थाईलैंड",
    bn: "থাইল্যান্ড",
    pt: "Tailândia",
    ja: "タイ",
    de: "Thailand",
    ko: "태국"
  },
  // Tunisia
  "tn": {
    ar: "تونس",
    en: "Tunisia",
    fr: "Tunisie",
    ru: "Тунис",
    es: "Túnez",
    zh: "突尼斯",
    hi: "ट्यूनीशिया",
    bn: "তিউনিসিয়া",
    pt: "Tunísia",
    ja: "チュニジア",
    de: "Tunesien",
    ko: "튀니지"
  },
  // Turkey
  "tr": {
    ar: "تركيا",
    en: "Turkey",
    fr: "Turquie",
    ru: "Турция",
    es: "Turquía",
    zh: "土耳其",
    hi: "तुर्की",
    bn: "তুরস্ক",
    pt: "Turquia",
    ja: "トルコ",
    de: "Türkei",
    ko: "터키"
  },
  // Ukraine
  "ua": {
    ar: "أوكرانيا",
    en: "Ukraine",
    fr: "Ukraine",
    ru: "Украина",
    es: "Ucrania",
    zh: "乌克兰",
    hi: "यूक्रेन",
    bn: "ইউক্রেন",
    pt: "Ucrânia",
    ja: "ウクライナ",
    de: "Ukraine",
    ko: "우크라이나"
  },
  // United Kingdom
  "uk": {
    ar: "المملكة المتحدة",
    en: "United Kingdom",
    fr: "Royaume-Uni",
    ru: "Великобритания",
    es: "Reino Unido",
    zh: "英国",
    hi: "यूनाइटेड किंगडम",
    bn: "যুক্তরাজ্য",
    pt: "Reino Unido",
    ja: "イギリス",
    de: "Vereinigtes Königreich",
    ko: "영국"
  },
  // United States
  "usa": {
    ar: "الولايات المتحدة",
    en: "United States",
    fr: "États-Unis",
    ru: "США",
    es: "Estados Unidos",
    zh: "美国",
    hi: "संयुक्त राज्य अमेरिका",
    bn: "মার্কিন যুক্তরাষ্ট্র",
    pt: "Estados Unidos",
    ja: "アメリカ",
    de: "Vereinigte Staaten",
    ko: "미국"
  },
  // Uruguay
  "uy": {
    ar: "الأوروغواي",
    en: "Uruguay",
    fr: "Uruguay",
    ru: "Уругвай",
    es: "Uruguay",
    zh: "乌拉圭",
    hi: "उरुग्वे",
    bn: "উরুগুয়ে",
    pt: "Uruguai",
    ja: "ウルグアイ",
    de: "Uruguay",
    ko: "우루과이"
  },
  // Vietnam
  "vn": {
    ar: "فيتنام",
    en: "Vietnam",
    fr: "Viêt Nam",
    ru: "Вьетнам",
    es: "Vietnam",
    zh: "越南",
    hi: "वियतनाम",
    bn: "ভিয়েতনাম",
    pt: "Vietnã",
    ja: "ベトナム",
    de: "Vietnam",
    ko: "베트남"
  },
  // South Africa
  "za": {
    ar: "جنوب أفريقيا",
    en: "South Africa",
    fr: "Afrique du Sud",
    ru: "Южная Африка",
    es: "Sudáfrica",
    zh: "南非",
    hi: "दक्षिण अफ्रीका",
    bn: "দক্ষিণ আফ্রিকা",
    pt: "África do Sul",
    ja: "南アフリカ",
    de: "Südafrika",
    ko: "남아프리카 공화국"
  },
  // Afghanistan
  "afghanistan": {
    ar: "أفغانستان", en: "Afghanistan", fr: "Afghanistan", ru: "Афганистан", es: "Afganistán",
    zh: "阿富汗", hi: "अफ़ग़ानिस्तान", bn: "আফগানিস্তান", pt: "Afeganistão", ja: "アフガニスタン", de: "Afghanistan", ko: "아프가니스탄"
  },
  // Albania
  "albania": {
    ar: "ألبانيا", en: "Albania", fr: "Albanie", ru: "Албания", es: "Albania",
    zh: "阿尔巴尼亚", hi: "अल्बानिया", bn: "আলবেনিয়া", pt: "Albânia", ja: "アルバニア", de: "Albanien", ko: "알바니아"
  },
  // Algeria
  "dz": {
    ar: "الجزائر", en: "Algeria", fr: "Algérie", ru: "Алжир", es: "Argelia",
    zh: "阿尔及利亚", hi: "अल्जीरिया", bn: "আলজেরিয়া", pt: "Argélia", ja: "アルジェリア", de: "Algerien", ko: "알제리"
  },
  // Andorra
  "andorra": {
    ar: "أندورا", en: "Andorra", fr: "Andorre", ru: "Андорра", es: "Andorra",
    zh: "安道尔", hi: "अंडोरा", bn: "অ্যান্ডোরা", pt: "Andorra", ja: "アンドラ", de: "Andorra", ko: "안도라"
  },
  // Angola
  "angola": {
    ar: "أنغولا", en: "Angola", fr: "Angola", ru: "Ангола", es: "Angola",
    zh: "安哥拉", hi: "अंगोला", bn: "অ্যাঙ্গোলা", pt: "Angola", ja: "アンゴラ", de: "Angola", ko: "앙골라"
  },
  // Antigua and Barbuda
  "antigua-and-barbuda": {
    ar: "أنتيغوا وباربودا", en: "Antigua and Barbuda", fr: "Antigua-et-Barbuda", ru: "Антигуа и Барбуда", es: "Antigua y Barbuda",
    zh: "安提瓜和巴布达", hi: "एंटीगुआ और बारबूडा", bn: "অ্যান্টিগুয়া ও বারবুডা", pt: "Antígua e Barbuda", ja: "アンティグア・バーブーダ", de: "Antigua und Barbuda", ko: "앤티가 바부다"
  },
  // Bahrain
  "bahrain": {
    ar: "البحرين", en: "Bahrain", fr: "Bahreïn", ru: "Бахрейн", es: "Baréin",
    zh: "巴林", hi: "बहरीन", bn: "বাহরাইন", pt: "Barém", ja: "バーレーン", de: "Bahrain", ko: "바레인"
  },
  // Barbados
  "barbados": {
    ar: "باربادوس", en: "Barbados", fr: "Barbade", ru: "Барбадос", es: "Barbados",
    zh: "巴巴多斯", hi: "बारबाडोस", bn: "বার্বাডোস", pt: "Barbados", ja: "バルバドス", de: "Barbados", ko: "바베이도스"
  },
  // Belize
  "belize": {
    ar: "بليز", en: "Belize", fr: "Belize", ru: "Белиз", es: "Belice",
    zh: "伯利兹", hi: "बेलीज़", bn: "বেলিজ", pt: "Belize", ja: "ベリーズ", de: "Belize", ko: "벨리즈"
  },
  // Benin
  "benin": {
    ar: "بنين", en: "Benin", fr: "Bénin", ru: "Бенин", es: "Benín",
    zh: "贝宁", hi: "बेनिन", bn: "বেনিন", pt: "Benim", ja: "ベナン", de: "Benin", ko: "베냉"
  },
  // Bhutan
  "bhutan": {
    ar: "بوتان", en: "Bhutan", fr: "Bhoutan", ru: "Бутан", es: "Bután",
    zh: "不丹", hi: "भूटान", bn: "ভুটান", pt: "Butão", ja: "ブータン", de: "Bhutan", ko: "부탄"
  },
  // Bolivia
  "bolivia": {
    ar: "بوليفيا", en: "Bolivia", fr: "Bolivie", ru: "Боливия", es: "Bolivia",
    zh: "玻利维亚", hi: "बोलीविया", bn: "বলিভিয়া", pt: "Bolívia", ja: "ボリビア", de: "Bolivien", ko: "볼리비아"
  },
  // Bosnia and Herzegovina
  "ba": {
    ar: "البوسنة والهرسك", en: "Bosnia and Herzegovina", fr: "Bosnie-Herzégovine", ru: "Босния и Герцеговина", es: "Bosnia y Herzegovina",
    zh: "波斯尼亚和黑塞哥维那", hi: "बोस्निया और हर्ज़ेगोविना", bn: "বসনিয়া ও হার্জেগোভিনা", pt: "Bósnia e Herzegovina", ja: "ボスニア・ヘルツェゴビナ", de: "Bosnien und Herzegowina", ko: "보스니아 헤르체고비나"
  },
  // Botswana
  "botswana": {
    ar: "بوتسوانا", en: "Botswana", fr: "Botswana", ru: "Ботсвана", es: "Botsuana",
    zh: "博茨瓦纳", hi: "बोत्सवाना", bn: "বতসোয়ানা", pt: "Botsuana", ja: "ボツワナ", de: "Botswana", ko: "보츠와나"
  },
  // Brunei
  "brunei": {
    ar: "بروناي", en: "Brunei", fr: "Brunei", ru: "Бруней", es: "Brunéi",
    zh: "文莱", hi: "ब्रुनेई", bn: "ব্রুনাই", pt: "Brunei", ja: "ブルネイ", de: "Brunei", ko: "브루나이"
  },
  // Burkina Faso
  "burkina-faso": {
    ar: "بوركينا فاسو", en: "Burkina Faso", fr: "Burkina Faso", ru: "Буркина-Фасо", es: "Burkina Faso",
    zh: "布基纳法索", hi: "बुर्किना फ़ासो", bn: "বুর্কিনা ফাসো", pt: "Burkina Faso", ja: "ブルキナファソ", de: "Burkina Faso", ko: "부르키나파소"
  },
  // Burundi
  "burundi": {
    ar: "بوروندي", en: "Burundi", fr: "Burundi", ru: "Бурунди", es: "Burundi",
    zh: "布隆迪", hi: "बुरुंडी", bn: "বুরুন্ডি", pt: "Burundi", ja: "ブルンジ", de: "Burundi", ko: "부룬디"
  },
  // Cabo Verde
  "cabo-verde": {
    ar: "الرأس الأخضر", en: "Cabo Verde", fr: "Cap-Vert", ru: "Кабо-Верде", es: "Cabo Verde",
    zh: "佛得角", hi: "काबो वर्दे", bn: "কেপ ভার্দে", pt: "Cabo Verde", ja: "カーボベルデ", de: "Kap Verde", ko: "카보베르데"
  },
  // Cambodia
  "cambodia": {
    ar: "كمبوديا", en: "Cambodia", fr: "Cambodge", ru: "Камбоджа", es: "Camboya",
    zh: "柬埔寨", hi: "कंबोडिया", bn: "কম্বোডিয়া", pt: "Camboja", ja: "カンボジア", de: "Kambodscha", ko: "캄보디아"
  },
  // Cameroon
  "cameroon": {
    ar: "الكاميرون", en: "Cameroon", fr: "Cameroun", ru: "Камерун", es: "Camerún",
    zh: "喀麦隆", hi: "कैमरून", bn: "ক্যামেরুন", pt: "Camarões", ja: "カメルーン", de: "Kamerun", ko: "카메룬"
  },
  // Central African Republic
  "central-african-republic": {
    ar: "جمهورية أفريقيا الوسطى", en: "Central African Republic", fr: "République centrafricaine", ru: "Центральноафриканская Республика", es: "República Centroafricana",
    zh: "中非共和国", hi: "मध्य अफ़्रीकी गणराज्य", bn: "মধ্য আফ্রিকান প্রজাতন্ত্র", pt: "República Centro-Africana", ja: "中央アフリカ共和国", de: "Zentralafrikanische Republik", ko: "중앙아프리카 공화국"
  },
  // Chad
  "chad": {
    ar: "تشاد", en: "Chad", fr: "Tchad", ru: "Чад", es: "Chad",
    zh: "乍得", hi: "चाड", bn: "চাদ", pt: "Chade", ja: "チャド", de: "Tschad", ko: "차드"
  },
  // Congo (DRC)
  "congo-drc": {
    ar: "جمهورية الكونغو الديمقراطية", en: "Congo (DRC)", fr: "République démocratique du Congo", ru: "Демократическая Республика Конго", es: "República Democrática del Congo",
    zh: "刚果民主共和国", hi: "कांगो लोकतांत्रिक गणराज्य", bn: "কঙ্গো গণতান্ত্রিক প্রজাতন্ত্র", pt: "República Democrática do Congo", ja: "コンゴ民主共和国", de: "Demokratische Republik Kongo", ko: "콩고 민주 공화국"
  },
  // Congo (Republic)
  "congo-republic": {
    ar: "جمهورية الكونغو", en: "Congo (Republic)", fr: "République du Congo", ru: "Республика Конго", es: "República del Congo",
    zh: "刚果共和国", hi: "कांगो गणराज्य", bn: "কঙ্গো প্রজাতন্ত্র", pt: "República do Congo", ja: "コンゴ共和国", de: "Republik Kongo", ko: "콩고 공화국"
  },
  // Côte d'Ivoire
  "cote-d-ivoire": {
    ar: "ساحل العاج", en: "Côte d'Ivoire", fr: "Côte d'Ivoire", ru: "Кот-д'Ивуар", es: "Costa de Marfil",
    zh: "科特迪瓦", hi: "कोत दिव्वार", bn: "কোত দিভোয়ার", pt: "Costa do Marfim", ja: "コートジボワール", de: "Elfenbeinküste", ko: "코트디부아르"
  },
  // Cuba
  "cuba": {
    ar: "كوبا", en: "Cuba", fr: "Cuba", ru: "Куба", es: "Cuba",
    zh: "古巴", hi: "क्यूबा", bn: "কিউবা", pt: "Cuba", ja: "キューバ", de: "Kuba", ko: "쿠바"
  },
  // Djibouti
  "djibouti": {
    ar: "جيبوتي", en: "Djibouti", fr: "Djibouti", ru: "Джибути", es: "Yibuti",
    zh: "吉布提", hi: "जिबूती", bn: "জিবুতি", pt: "Djibuti", ja: "ジブチ", de: "Dschibuti", ko: "지부티"
  },
  // Dominica
  "dominica": {
    ar: "دومينيكا", en: "Dominica", fr: "Dominique", ru: "Доминика", es: "Dominica",
    zh: "多米尼克", hi: "डोमिनिका", bn: "ডোমিনিকা", pt: "Dominica", ja: "ドミニカ国", de: "Dominica", ko: "도미니카 연방"
  },
  // Dominican Republic
  "dominican-republic": {
    ar: "جمهورية الدومينيكان", en: "Dominican Republic", fr: "République dominicaine", ru: "Доминиканская Республика", es: "República Dominicana",
    zh: "多米尼加共和国", hi: "डोमिनिकन गणराज्य", bn: "ডোমিনিকান প্রজাতন্ত্র", pt: "República Dominicana", ja: "ドミニカ共和国", de: "Dominikanische Republik", ko: "도미니카 공화국"
  },
  // El Salvador
  "el-salvador": {
    ar: "السلفادور", en: "El Salvador", fr: "Salvador", ru: "Сальвадор", es: "El Salvador",
    zh: "萨尔瓦多", hi: "अल सल्वाडोर", bn: "এল সালভাদর", pt: "El Salvador", ja: "エルサルバドル", de: "El Salvador", ko: "엘살바도르"
  },
  // Equatorial Guinea
  "equatorial-guinea": {
    ar: "غينيا الاستوائية", en: "Equatorial Guinea", fr: "Guinée équatoriale", ru: "Экваториальная Гвинея", es: "Guinea Ecuatorial",
    zh: "赤道几内亚", hi: "इक्वेटोरियल गिनी", bn: "বিষুবীয় গিনি", pt: "Guiné Equatorial", ja: "赤道ギニア", de: "Äquatorialguinea", ko: "적도 기니"
  },
  // Eritrea
  "eritrea": {
    ar: "إريتريا", en: "Eritrea", fr: "Érythrée", ru: "Эритрея", es: "Eritrea",
    zh: "厄立特里亚", hi: "इरीट्रिया", bn: "ইরিত্রিয়া", pt: "Eritreia", ja: "エリトリア", de: "Eritrea", ko: "에리트레아"
  },
  // Eswatini
  "eswatini": {
    ar: "إسواتيني", en: "Eswatini", fr: "Eswatini", ru: "Эсватини", es: "Esuatini",
    zh: "斯威士兰", hi: "एस्वातिनी", bn: "ইসোয়াতিনি", pt: "Essuatíni", ja: "エスワティニ", de: "Eswatini", ko: "에스와티니"
  },
  // Ethiopia
  "ethiopia": {
    ar: "إثيوبيا", en: "Ethiopia", fr: "Éthiopie", ru: "Эфиопия", es: "Etiopía",
    zh: "埃塞俄比亚", hi: "इथियोपिया", bn: "ইথিওপিয়া", pt: "Etiópia", ja: "エチオピア", de: "Äthiopien", ko: "에티오피아"
  },
  // Fiji
  "fiji": {
    ar: "فيجي", en: "Fiji", fr: "Fidji", ru: "Фиджи", es: "Fiyi",
    zh: "斐济", hi: "फिजी", bn: "ফিজি", pt: "Fiji", ja: "フィジー", de: "Fidschi", ko: "피지"
  },
  // Gabon
  "gabon": {
    ar: "الغابون", en: "Gabon", fr: "Gabon", ru: "Габон", es: "Gabón",
    zh: "加蓬", hi: "गैबॉन", bn: "গ্যাবন", pt: "Gabão", ja: "ガボン", de: "Gabun", ko: "가봉"
  },
  // Gambia
  "gambia": {
    ar: "غامبيا", en: "Gambia", fr: "Gambie", ru: "Гамбия", es: "Gambia",
    zh: "冈比亚", hi: "गाम्बिया", bn: "গাম্বিয়া", pt: "Gâmbia", ja: "ガンビア", de: "Gambia", ko: "감비아"
  },
  // Grenada
  "gd": {
    ar: "غرينادا", en: "Grenada", fr: "Grenade", ru: "Гренада", es: "Granada",
    zh: "格林纳达", hi: "ग्रेनाडा", bn: "গ্রেনাডা", pt: "Granada", ja: "グレナダ", de: "Grenada", ko: "그레나다"
  },
  // Guatemala
  "guatemala": {
    ar: "غواتيمالا", en: "Guatemala", fr: "Guatemala", ru: "Гватемала", es: "Guatemala",
    zh: "危地马拉", hi: "ग्वाटेमाला", bn: "গুয়াতেমালা", pt: "Guatemala", ja: "グアテマラ", de: "Guatemala", ko: "과테말라"
  },
  // Guinea
  "guinea": {
    ar: "غينيا", en: "Guinea", fr: "Guinée", ru: "Гвинея", es: "Guinea",
    zh: "几内亚", hi: "गिनी", bn: "গিনি", pt: "Guiné", ja: "ギニア", de: "Guinea", ko: "기니"
  },
  // Guinea-Bissau
  "guinea-bissau": {
    ar: "غينيا بيساو", en: "Guinea-Bissau", fr: "Guinée-Bissau", ru: "Гвинея-Бисау", es: "Guinea-Bisáu",
    zh: "几内亚比绍", hi: "गिनी-बिसाउ", bn: "গিনি-বিসাউ", pt: "Guiné-Bissau", ja: "ギニアビサウ", de: "Guinea-Bissau", ko: "기니비사우"
  },
  // Guyana
  "guyana": {
    ar: "غيانا", en: "Guyana", fr: "Guyana", ru: "Гайана", es: "Guyana",
    zh: "圭亚那", hi: "गुयाना", bn: "গায়ানা", pt: "Guiana", ja: "ガイアナ", de: "Guyana", ko: "가이아나"
  },
  // Haiti
  "haiti": {
    ar: "هايتي", en: "Haiti", fr: "Haïti", ru: "Гаити", es: "Haití",
    zh: "海地", hi: "हैती", bn: "হাইতি", pt: "Haiti", ja: "ハイチ", de: "Haiti", ko: "아이티"
  },
  // Honduras
  "honduras": {
    ar: "هندوراس", en: "Honduras", fr: "Honduras", ru: "Гондурас", es: "Honduras",
    zh: "洪都拉斯", hi: "होंडुरास", bn: "হন্ডুরাস", pt: "Honduras", ja: "ホンジュラス", de: "Honduras", ko: "온두라스"
  },
  // Iraq
  "iraq": {
    ar: "العراق", en: "Iraq", fr: "Irak", ru: "Ирак", es: "Irak",
    zh: "伊拉克", hi: "इराक", bn: "ইরাক", pt: "Iraque", ja: "イラク", de: "Irak", ko: "이라크"
  },
  // Jamaica
  "jm": {
    ar: "جامايكا", en: "Jamaica", fr: "Jamaïque", ru: "Ямайка", es: "Jamaica",
    zh: "牙买加", hi: "जमैका", bn: "জ্যামাইকা", pt: "Jamaica", ja: "ジャマイカ", de: "Jamaika", ko: "자메이카"
  },
  // Kiribati
  "kiribati": {
    ar: "كيريباتي", en: "Kiribati", fr: "Kiribati", ru: "Кирибати", es: "Kiribati",
    zh: "基里巴斯", hi: "किरिबाती", bn: "কিরিবাতি", pt: "Quiribáti", ja: "キリバス", de: "Kiribati", ko: "키리바시"
  },
  // Kosovo
  "kosovo": {
    ar: "كوسوفو", en: "Kosovo", fr: "Kosovo", ru: "Косово", es: "Kosovo",
    zh: "科索沃", hi: "कोसोवो", bn: "কসোভো", pt: "Kosovo", ja: "コソボ", de: "Kosovo", ko: "코소보"
  },
  // Kyrgyzstan
  "kyrgyzstan": {
    ar: "قيرغيزستان", en: "Kyrgyzstan", fr: "Kirghizistan", ru: "Киргизия", es: "Kirguistán",
    zh: "吉尔吉斯斯坦", hi: "किर्गिज़स्तान", bn: "কিরগিজস্তান", pt: "Quirguistão", ja: "キルギス", de: "Kirgisistan", ko: "키르기스스탄"
  },
  // Laos
  "laos": {
    ar: "لاوس", en: "Laos", fr: "Laos", ru: "Лаос", es: "Laos",
    zh: "老挝", hi: "लाओस", bn: "লাওস", pt: "Laos", ja: "ラオス", de: "Laos", ko: "라오스"
  },
  // Lesotho
  "lesotho": {
    ar: "ليسوتو", en: "Lesotho", fr: "Lesotho", ru: "Лесото", es: "Lesoto",
    zh: "莱索托", hi: "लेसोथो", bn: "লেসোথো", pt: "Lesoto", ja: "レソト", de: "Lesotho", ko: "레소토"
  },
  // Liberia
  "liberia": {
    ar: "ليبيريا", en: "Liberia", fr: "Libéria", ru: "Либерия", es: "Liberia",
    zh: "利比里亚", hi: "लाइबेरिया", bn: "লাইবেরিয়া", pt: "Libéria", ja: "リベリア", de: "Liberia", ko: "라이베리아"
  },
  // Libya
  "libya": {
    ar: "ليبيا", en: "Libya", fr: "Libye", ru: "Ливия", es: "Libia",
    zh: "利比亚", hi: "लीबिया", bn: "লিবিয়া", pt: "Líbia", ja: "リビア", de: "Libyen", ko: "리비아"
  },
  // Liechtenstein
  "liechtenstein": {
    ar: "ليختنشتاين", en: "Liechtenstein", fr: "Liechtenstein", ru: "Лихтенштейн", es: "Liechtenstein",
    zh: "列支敦士登", hi: "लिख्टेंश्टाइन", bn: "লিশটেনস্টাইন", pt: "Liechtenstein", ja: "リヒテンシュタイン", de: "Liechtenstein", ko: "리히텐슈타인"
  },
  // Madagascar
  "madagascar": {
    ar: "مدغشقر", en: "Madagascar", fr: "Madagascar", ru: "Мадагаскар", es: "Madagascar",
    zh: "马达加斯加", hi: "मेडागास्कर", bn: "মাদাগাস্কার", pt: "Madagáscar", ja: "マダガスカル", de: "Madagaskar", ko: "마다가스카르"
  },
  // Malawi
  "malawi": {
    ar: "مالاوي", en: "Malawi", fr: "Malawi", ru: "Малави", es: "Malaui",
    zh: "马拉维", hi: "मलावी", bn: "মালাউই", pt: "Malawi", ja: "マラウイ", de: "Malawi", ko: "말라위"
  },
  // Maldives
  "maldives": {
    ar: "المالديف", en: "Maldives", fr: "Maldives", ru: "Мальдивы", es: "Maldivas",
    zh: "马尔代夫", hi: "मालदीव", bn: "মালদ্বীপ", pt: "Maldivas", ja: "モルディブ", de: "Malediven", ko: "몰디브"
  },
  // Mali
  "mali": {
    ar: "مالي", en: "Mali", fr: "Mali", ru: "Мали", es: "Malí",
    zh: "马里", hi: "माली", bn: "মালি", pt: "Mali", ja: "マリ", de: "Mali", ko: "말리"
  },
  // Marshall Islands
  "marshall-islands": {
    ar: "جزر مارشال", en: "Marshall Islands", fr: "Îles Marshall", ru: "Маршалловы Острова", es: "Islas Marshall",
    zh: "马绍尔群岛", hi: "मार्शल द्वीप समूह", bn: "মার্শাল দ্বীপপুঞ্জ", pt: "Ilhas Marshall", ja: "マーシャル諸島", de: "Marshallinseln", ko: "마셜 제도"
  },
  // Mauritania
  "mauritania": {
    ar: "موريتانيا", en: "Mauritania", fr: "Mauritanie", ru: "Мавритания", es: "Mauritania",
    zh: "毛里塔尼亚", hi: "मॉरिटानिया", bn: "মৌরিতানিয়া", pt: "Mauritânia", ja: "モーリタニア", de: "Mauretanien", ko: "모리타니"
  },
  // Mauritius
  "mauritius": {
    ar: "موريشيوس", en: "Mauritius", fr: "Maurice", ru: "Маврикий", es: "Mauricio",
    zh: "毛里求斯", hi: "मॉरीशस", bn: "মরিশাস", pt: "Maurícia", ja: "モーリシャス", de: "Mauritius", ko: "모리셔스"
  },
  // Micronesia
  "micronesia": {
    ar: "ميكرونيزيا", en: "Micronesia", fr: "Micronésie", ru: "Микронезия", es: "Micronesia",
    zh: "密克罗尼西亚", hi: "माइक्रोनेशिया", bn: "মাইক্রোনেশিয়া", pt: "Micronésia", ja: "ミクロネシア", de: "Mikronesien", ko: "미크로네시아"
  },
  // Moldova
  "moldova": {
    ar: "مولدوفا", en: "Moldova", fr: "Moldavie", ru: "Молдавия", es: "Moldavia",
    zh: "摩尔多瓦", hi: "मोल्दोवा", bn: "মলদোভা", pt: "Moldávia", ja: "モルドバ", de: "Moldau", ko: "몰도바"
  },
  // Monaco
  "monaco": {
    ar: "موناكو", en: "Monaco", fr: "Monaco", ru: "Монако", es: "Mónaco",
    zh: "摩纳哥", hi: "मोनाको", bn: "মোনাকো", pt: "Mónaco", ja: "モナコ", de: "Monaco", ko: "모나코"
  },
  // Mongolia
  "mongolia": {
    ar: "منغوليا", en: "Mongolia", fr: "Mongolie", ru: "Монголия", es: "Mongolia",
    zh: "蒙古", hi: "मंगोलिया", bn: "মঙ্গোলিয়া", pt: "Mongólia", ja: "モンゴル", de: "Mongolei", ko: "몽골"
  },
  // Montenegro
  "montenegro": {
    ar: "الجبل الأسود", en: "Montenegro", fr: "Monténégro", ru: "Черногория", es: "Montenegro",
    zh: "黑山", hi: "मोंटेनेग्रो", bn: "মন্টিনিগ্রো", pt: "Montenegro", ja: "モンテネグロ", de: "Montenegro", ko: "몬테네그로"
  },
  // Mozambique
  "mozambique": {
    ar: "موزمبيق", en: "Mozambique", fr: "Mozambique", ru: "Мозамбик", es: "Mozambique",
    zh: "莫桑比克", hi: "मोज़ाम्बिक", bn: "মোজাম্বিক", pt: "Moçambique", ja: "モザンビーク", de: "Mosambik", ko: "모잠비크"
  },
  // Myanmar
  "myanmar": {
    ar: "ميانمار", en: "Myanmar", fr: "Myanmar", ru: "Мьянма", es: "Myanmar",
    zh: "缅甸", hi: "म्यांमार", bn: "মায়ানমার", pt: "Mianmar", ja: "ミャンマー", de: "Myanmar", ko: "미얀마"
  },
  // Namibia
  "na": {
    ar: "ناميبيا", en: "Namibia", fr: "Namibie", ru: "Намибия", es: "Namibia",
    zh: "纳米比亚", hi: "नामीबिया", bn: "নামিবিয়া", pt: "Namíbia", ja: "ナミビア", de: "Namibia", ko: "나미비아"
  },
  // Nauru
  "nauru": {
    ar: "ناورو", en: "Nauru", fr: "Nauru", ru: "Науру", es: "Nauru",
    zh: "瑙鲁", hi: "नाउरू", bn: "নাউরু", pt: "Nauru", ja: "ナウル", de: "Nauru", ko: "나우루"
  },
  // Nicaragua
  "nicaragua": {
    ar: "نيكاراغوا", en: "Nicaragua", fr: "Nicaragua", ru: "Никарагуа", es: "Nicaragua",
    zh: "尼加拉瓜", hi: "निकारागुआ", bn: "নিকারাগুয়া", pt: "Nicarágua", ja: "ニカラグア", de: "Nicaragua", ko: "니카라과"
  },
  // Niger
  "niger": {
    ar: "النيجر", en: "Niger", fr: "Niger", ru: "Нигер", es: "Níger",
    zh: "尼日尔", hi: "नाइजर", bn: "নাইজার", pt: "Níger", ja: "ニジェール", de: "Niger", ko: "니제르"
  },
  // North Macedonia
  "north-macedonia": {
    ar: "مقدونيا الشمالية", en: "North Macedonia", fr: "Macédoine du Nord", ru: "Северная Македония", es: "Macedonia del Norte",
    zh: "北马其顿", hi: "उत्तर मैसेडोनिया", bn: "উত্তর ম্যাসেডোনিয়া", pt: "Macedónia do Norte", ja: "北マケドニア", de: "Nordmazedonien", ko: "북마케도니아"
  },
  // Oman
  "oman": {
    ar: "عُمان", en: "Oman", fr: "Oman", ru: "Оман", es: "Omán",
    zh: "阿曼", hi: "ओमान", bn: "ওমান", pt: "Omã", ja: "オマーン", de: "Oman", ko: "오만"
  },
  // Palau
  "palau": {
    ar: "بالاو", en: "Palau", fr: "Palaos", ru: "Палау", es: "Palaos",
    zh: "帕劳", hi: "पलाऊ", bn: "পালাউ", pt: "Palau", ja: "パラオ", de: "Palau", ko: "팔라우"
  },
  // Palestine
  "palestine": {
    ar: "فلسطين", en: "Palestine", fr: "Palestine", ru: "Палестина", es: "Palestina",
    zh: "巴勒斯坦", hi: "फ़िलिस्तीन", bn: "ফিলিস্তিন", pt: "Palestina", ja: "パレスチナ", de: "Palästina", ko: "팔레스타인"
  },
  // Panama
  "panama": {
    ar: "بنما", en: "Panama", fr: "Panama", ru: "Панама", es: "Panamá",
    zh: "巴拿马", hi: "पनामा", bn: "পানামা", pt: "Panamá", ja: "パナマ", de: "Panama", ko: "파나마"
  },
  // Papua New Guinea
  "papua-new-guinea": {
    ar: "بابوا غينيا الجديدة", en: "Papua New Guinea", fr: "Papouasie-Nouvelle-Guinée", ru: "Папуа — Новая Гвинея", es: "Papúa Nueva Guinea",
    zh: "巴布亚新几内亚", hi: "पापुआ न्यू गिनी", bn: "পাপুয়া নিউ গিনি", pt: "Papua-Nova Guiné", ja: "パプアニューギニア", de: "Papua-Neuguinea", ko: "파푸아뉴기니"
  },
  // Paraguay
  "paraguay": {
    ar: "باراغواي", en: "Paraguay", fr: "Paraguay", ru: "Парагвай", es: "Paraguay",
    zh: "巴拉圭", hi: "पैराग्वे", bn: "প্যারাগুয়ে", pt: "Paraguai", ja: "パラグアイ", de: "Paraguay", ko: "파라과이"
  },
  // Puerto Rico
  "pr": {
    ar: "بورتوريكو", en: "Puerto Rico", fr: "Porto Rico", ru: "Пуэрто-Рико", es: "Puerto Rico",
    zh: "波多黎各", hi: "प्यूर्टो रिको", bn: "পুয়ের্তো রিকো", pt: "Porto Rico", ja: "プエルトリコ", de: "Puerto Rico", ko: "푸에르토리코"
  },
  // Rwanda
  "rwanda": {
    ar: "رواندا", en: "Rwanda", fr: "Rwanda", ru: "Руанда", es: "Ruanda",
    zh: "卢旺达", hi: "रवांडा", bn: "রুয়ান্ডা", pt: "Ruanda", ja: "ルワンダ", de: "Ruanda", ko: "르완다"
  },
  // Saint Kitts and Nevis
  "saint-kitts-and-nevis": {
    ar: "سانت كيتس ونيفيس", en: "Saint Kitts and Nevis", fr: "Saint-Kitts-et-Nevis", ru: "Сент-Китс и Невис", es: "San Cristóbal y Nieves",
    zh: "圣基茨和尼维斯", hi: "सेंट किट्स और नेविस", bn: "সেন্ট কিটস ও নেভিস", pt: "São Cristóvão e Neves", ja: "セントクリストファー・ネイビス", de: "St. Kitts und Nevis", ko: "세인트키츠 네비스"
  },
  // Saint Lucia
  "saint-lucia": {
    ar: "سانت لوسيا", en: "Saint Lucia", fr: "Sainte-Lucie", ru: "Сент-Люсия", es: "Santa Lucía",
    zh: "圣卢西亚", hi: "सेंट लूसिया", bn: "সেন্ট লুসিয়া", pt: "Santa Lúcia", ja: "セントルシア", de: "St. Lucia", ko: "세인트루시아"
  },
  // Saint Vincent and the Grenadines
  "saint-vincent": {
    ar: "سانت فنسنت والغرينادين", en: "Saint Vincent and the Grenadines", fr: "Saint-Vincent-et-les-Grenadines", ru: "Сент-Винсент и Гренадины", es: "San Vicente y las Granadinas",
    zh: "圣文森特和格林纳丁斯", hi: "सेंट विंसेंट और ग्रेनेडाइंस", bn: "সেন্ট ভিনসেন্ট ও গ্রেনাডাইন", pt: "São Vicente e Granadinas", ja: "セントビンセント・グレナディーン", de: "St. Vincent und die Grenadinen", ko: "세인트빈센트 그레나딘"
  },
  // Samoa
  "samoa": {
    ar: "ساموا", en: "Samoa", fr: "Samoa", ru: "Самоа", es: "Samoa",
    zh: "萨摩亚", hi: "समोआ", bn: "সামোয়া", pt: "Samoa", ja: "サモア", de: "Samoa", ko: "사모아"
  },
  // San Marino
  "san-marino": {
    ar: "سان مارينو", en: "San Marino", fr: "Saint-Marin", ru: "Сан-Марино", es: "San Marino",
    zh: "圣马力诺", hi: "सैन मारिनो", bn: "সান মারিনো", pt: "San Marino", ja: "サンマリノ", de: "San Marino", ko: "산마리노"
  },
  // São Tomé and Príncipe
  "sao-tome-and-principe": {
    ar: "ساو تومي وبرينسيبي", en: "São Tomé and Príncipe", fr: "São Tomé-et-Príncipe", ru: "Сан-Томе и Принсипи", es: "Santo Tomé y Príncipe",
    zh: "圣多美和普林西比", hi: "साओ तोमे और प्रिंसिपे", bn: "সাঁউ তুমি ও প্রিন্সিপি", pt: "São Tomé e Príncipe", ja: "サントメ・プリンシペ", de: "São Tomé und Príncipe", ko: "상투메 프린시페"
  },
  // Sudan
  "sd": {
    ar: "السودان", en: "Sudan", fr: "Soudan", ru: "Судан", es: "Sudán",
    zh: "苏丹", hi: "सूडान", bn: "সুদান", pt: "Sudão", ja: "スーダン", de: "Sudan", ko: "수단"
  },
  // Senegal
  "senegal": {
    ar: "السنغال", en: "Senegal", fr: "Sénégal", ru: "Сенегал", es: "Senegal",
    zh: "塞内加尔", hi: "सेनेगल", bn: "সেনেগাল", pt: "Senegal", ja: "セネガル", de: "Senegal", ko: "세네갈"
  },
  // Seychelles
  "seychelles": {
    ar: "سيشل", en: "Seychelles", fr: "Seychelles", ru: "Сейшелы", es: "Seychelles",
    zh: "塞舌尔", hi: "सेशेल्स", bn: "সেশেল", pt: "Seicheles", ja: "セーシェル", de: "Seychellen", ko: "세이셸"
  },
  // Sierra Leone
  "sierra-leone": {
    ar: "سيراليون", en: "Sierra Leone", fr: "Sierra Leone", ru: "Сьерра-Леоне", es: "Sierra Leona",
    zh: "塞拉利昂", hi: "सिएरा लियोन", bn: "সিয়েরা লিওন", pt: "Serra Leoa", ja: "シエラレオネ", de: "Sierra Leone", ko: "시에라리온"
  },
  // Slovakia
  "sk": {
    ar: "سلوفاكيا", en: "Slovakia", fr: "Slovaquie", ru: "Словакия", es: "Eslovaquia",
    zh: "斯洛伐克", hi: "स्लोवाकिया", bn: "স্লোভাকিয়া", pt: "Eslováquia", ja: "スロバキア", de: "Slowakei", ko: "슬로바키아"
  },
  // Solomon Islands
  "solomon-islands": {
    ar: "جزر سليمان", en: "Solomon Islands", fr: "Îles Salomon", ru: "Соломоновы Острова", es: "Islas Salomón",
    zh: "所罗门群岛", hi: "सोलोमन द्वीप समूह", bn: "সলোমন দ্বীপপুঞ্জ", pt: "Ilhas Salomão", ja: "ソロモン諸島", de: "Salomonen", ko: "솔로몬 제도"
  },
  // Somalia
  "somalia": {
    ar: "الصومال", en: "Somalia", fr: "Somalie", ru: "Сомали", es: "Somalia",
    zh: "索马里", hi: "सोमालिया", bn: "সোমালিয়া", pt: "Somália", ja: "ソマリア", de: "Somalia", ko: "소말리아"
  },
  // South Sudan
  "south-sudan": {
    ar: "جنوب السودان", en: "South Sudan", fr: "Soudan du Sud", ru: "Южный Судан", es: "Sudán del Sur",
    zh: "南苏丹", hi: "दक्षिण सूडान", bn: "দক্ষিণ সুদান", pt: "Sudão do Sul", ja: "南スーダン", de: "Südsudan", ko: "남수단"
  },
  // Suriname
  "suriname": {
    ar: "سورينام", en: "Suriname", fr: "Suriname", ru: "Суринам", es: "Surinam",
    zh: "苏里南", hi: "सूरीनाम", bn: "সুরিনাম", pt: "Suriname", ja: "スリナム", de: "Suriname", ko: "수리남"
  },
  // Syria
  "syria": {
    ar: "سوريا", en: "Syria", fr: "Syrie", ru: "Сирия", es: "Siria",
    zh: "叙利亚", hi: "सीरिया", bn: "সিরিয়া", pt: "Síria", ja: "シリア", de: "Syrien", ko: "시리아"
  },
  // Tajikistan
  "tajikistan": {
    ar: "طاجيكستان", en: "Tajikistan", fr: "Tadjikistan", ru: "Таджикистан", es: "Tayikistán",
    zh: "塔吉克斯坦", hi: "ताजिकिस्तान", bn: "তাজিকিস্তান", pt: "Tajiquistão", ja: "タジキスタン", de: "Tadschikistan", ko: "타지키스탄"
  },
  // Tanzania
  "tz": {
    ar: "تنزانيا", en: "Tanzania", fr: "Tanzanie", ru: "Танзания", es: "Tanzania",
    zh: "坦桑尼亚", hi: "तंज़ानिया", bn: "তানজানিয়া", pt: "Tanzânia", ja: "タンザニア", de: "Tansania", ko: "탄자니아"
  },
  // Timor-Leste
  "timor-leste": {
    ar: "تيمور الشرقية", en: "Timor-Leste", fr: "Timor oriental", ru: "Восточный Тимор", es: "Timor Oriental",
    zh: "东帝汶", hi: "पूर्वी तिमोर", bn: "পূর্ব তিমুর", pt: "Timor-Leste", ja: "東ティモール", de: "Osttimor", ko: "동티모르"
  },
  // Togo
  "togo": {
    ar: "توغو", en: "Togo", fr: "Togo", ru: "Того", es: "Togo",
    zh: "多哥", hi: "टोगो", bn: "টোগো", pt: "Togo", ja: "トーゴ", de: "Togo", ko: "토고"
  },
  // Tonga
  "tonga": {
    ar: "تونغا", en: "Tonga", fr: "Tonga", ru: "Тонга", es: "Tonga",
    zh: "汤加", hi: "टोंगा", bn: "টোঙ্গা", pt: "Tonga", ja: "トンガ", de: "Tonga", ko: "통가"
  },
  // Trinidad and Tobago
  "trinidad-and-tobago": {
    ar: "ترينيداد وتوباغو", en: "Trinidad and Tobago", fr: "Trinité-et-Tobago", ru: "Тринидад и Тобаго", es: "Trinidad y Tobago",
    zh: "特立尼达和多巴哥", hi: "त्रिनिडाड और टोबैगो", bn: "ত্রিনিদাদ ও টোবাগো", pt: "Trinidad e Tobago", ja: "トリニダード・トバゴ", de: "Trinidad und Tobago", ko: "트리니다드 토바고"
  },
  // Turkmenistan
  "turkmenistan": {
    ar: "تركمانستان", en: "Turkmenistan", fr: "Turkménistan", ru: "Туркменистан", es: "Turkmenistán",
    zh: "土库曼斯坦", hi: "तुर्कमेनिस्तान", bn: "তুর্কমেনিস্তান", pt: "Turcomenistão", ja: "トルクメニスタン", de: "Turkmenistan", ko: "투르크메니스탄"
  },
  // Tuvalu
  "tuvalu": {
    ar: "توفالو", en: "Tuvalu", fr: "Tuvalu", ru: "Тувалу", es: "Tuvalu",
    zh: "图瓦卢", hi: "तुवालू", bn: "তুভালু", pt: "Tuvalu", ja: "ツバル", de: "Tuvalu", ko: "투발루"
  },
  // Uganda
  "ug": {
    ar: "أوغندا", en: "Uganda", fr: "Ouganda", ru: "Уганда", es: "Uganda",
    zh: "乌干达", hi: "युगांडा", bn: "উগান্ডা", pt: "Uganda", ja: "ウガンダ", de: "Uganda", ko: "우간다"
  },
  // Uzbekistan
  "uzbekistan": {
    ar: "أوزبكستان", en: "Uzbekistan", fr: "Ouzbékistan", ru: "Узбекистан", es: "Uzbekistán",
    zh: "乌兹别克斯坦", hi: "उज़्बेकिस्तान", bn: "উজবেকিস্তান", pt: "Uzbequistão", ja: "ウズベキスタン", de: "Usbekistan", ko: "우즈베키스탄"
  },
  // Vanuatu
  "vanuatu": {
    ar: "فانواتو", en: "Vanuatu", fr: "Vanuatu", ru: "Вануату", es: "Vanuatu",
    zh: "瓦努阿图", hi: "वानुअतु", bn: "ভানুয়াতু", pt: "Vanuatu", ja: "バヌアツ", de: "Vanuatu", ko: "바누아투"
  },
  // Vatican City
  "vatican-city": {
    ar: "الفاتيكان", en: "Vatican City", fr: "Cité du Vatican", ru: "Ватикан", es: "Ciudad del Vaticano",
    zh: "梵蒂冈", hi: "वेटिकन सिटी", bn: "ভ্যাটিকান সিটি", pt: "Cidade do Vaticano", ja: "バチカン", de: "Vatikanstadt", ko: "바티칸 시국"
  },
  // Venezuela
  "ve": {
    ar: "فنزويلا", en: "Venezuela", fr: "Venezuela", ru: "Венесуэла", es: "Venezuela",
    zh: "委内瑞拉", hi: "वेनेज़ुएला", bn: "ভেনেজুয়েলা", pt: "Venezuela", ja: "ベネズエラ", de: "Venezuela", ko: "베네수엘라"
  },
  // Yemen
  "yemen": {
    ar: "اليمن", en: "Yemen", fr: "Yémen", ru: "Йемен", es: "Yemen",
    zh: "也门", hi: "यमन", bn: "ইয়েমেন", pt: "Iémen", ja: "イエメン", de: "Jemen", ko: "예멘"
  },
  // Zambia
  "zambia": {
    ar: "زامبيا", en: "Zambia", fr: "Zambie", ru: "Замбия", es: "Zambia",
    zh: "赞比亚", hi: "ज़ाम्बिया", bn: "জাম্বিয়া", pt: "Zâmbia", ja: "ザンビア", de: "Sambia", ko: "잠비아"
  },
  // Zimbabwe
  "zimbabwe": {
    ar: "زيمبابوي", en: "Zimbabwe", fr: "Zimbabwe", ru: "Зимбабве", es: "Zimbabue",
    zh: "津巴布韦", hi: "ज़िम्बाब्वे", bn: "জিম্বাবুয়ে", pt: "Zimbabué", ja: "ジンバブエ", de: "Simbabwe", ko: "짐바브웨"
  }
};

/**
 * Get translated country name by slug
 * @param slug - Country slug from database
 * @param language - Target language code
 * @param fallback - Optional fallback if translation not found
 */
export function getCountryNameBySlug(
  slug: string, 
  language: string, 
  fallback?: string
): string {
  const lang = language as SupportedLanguage;
  return COUNTRY_NAMES[slug]?.[lang] 
    || COUNTRY_NAMES[slug]?.en 
    || fallback 
    || slug;
}
