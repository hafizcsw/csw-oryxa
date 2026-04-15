import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Comprehensive university domain mappings
const UNIVERSITY_DOMAINS: Record<string, string> = {
  // ===================== USA =====================
  "harvard": "harvard.edu",
  "stanford": "stanford.edu",
  "mit": "mit.edu",
  "yale": "yale.edu",
  "princeton": "princeton.edu",
  "columbia": "columbia.edu",
  "upenn": "upenn.edu",
  "penn": "upenn.edu",
  "cornell": "cornell.edu",
  "brown": "brown.edu",
  "dartmouth": "dartmouth.edu",
  "duke": "duke.edu",
  "northwestern": "northwestern.edu",
  "chicago": "uchicago.edu",
  "berkeley": "berkeley.edu",
  "ucla": "ucla.edu",
  "usc": "usc.edu",
  "nyu": "nyu.edu",
  "michigan": "umich.edu",
  "johns hopkins": "jhu.edu",
  "caltech": "caltech.edu",
  "carnegie mellon": "cmu.edu",
  "emory": "emory.edu",
  "georgetown": "georgetown.edu",
  "notre dame": "nd.edu",
  "vanderbilt": "vanderbilt.edu",
  "rice": "rice.edu",
  "washington university": "wustl.edu",
  "boston university": "bu.edu",
  "boston college": "bc.edu",
  "tufts": "tufts.edu",
  "brandeis": "brandeis.edu",
  "rutgers": "rutgers.edu",
  "purdue": "purdue.edu",
  "penn state": "psu.edu",
  "ohio state": "osu.edu",
  "michigan state": "msu.edu",
  "indiana university": "iu.edu",
  "university of washington": "uw.edu",
  "university of texas": "utexas.edu",
  "ut austin": "utexas.edu",
  "georgia tech": "gatech.edu",
  "unc chapel hill": "unc.edu",
  "university of virginia": "virginia.edu",
  "uva": "virginia.edu",
  "university of florida": "ufl.edu",
  "hofstra": "hofstra.edu",
  "adelphi": "adelphi.edu",
  "american university": "american.edu",
  
  // ===================== UK =====================
  "oxford": "ox.ac.uk",
  "cambridge": "cam.ac.uk",
  "imperial": "imperial.ac.uk",
  "ucl": "ucl.ac.uk",
  "london school of economics": "lse.ac.uk",
  "lse": "lse.ac.uk",
  "king's college": "kcl.ac.uk",
  "edinburgh": "ed.ac.uk",
  "manchester": "manchester.ac.uk",
  "warwick": "warwick.ac.uk",
  "bristol": "bristol.ac.uk",
  "glasgow": "gla.ac.uk",
  "birmingham": "bham.ac.uk",
  "leeds": "leeds.ac.uk",
  "sheffield": "sheffield.ac.uk",
  "nottingham": "nottingham.ac.uk",
  "southampton": "southampton.ac.uk",
  "exeter": "exeter.ac.uk",
  "durham": "durham.ac.uk",
  "york": "york.ac.uk",
  "lancaster": "lancaster.ac.uk",
  "bath": "bath.ac.uk",
  "surrey": "surrey.ac.uk",
  "sussex": "sussex.ac.uk",
  "kent": "kent.ac.uk",
  "reading": "reading.ac.uk",
  "cardiff": "cardiff.ac.uk",
  "queen mary": "qmul.ac.uk",
  "royal holloway": "royalholloway.ac.uk",
  "st andrews": "st-andrews.ac.uk",
  "aston": "aston.ac.uk",
  "city, university of london": "city.ac.uk",
  "university of london": "london.ac.uk",
  
  // ===================== Germany =====================
  // Major Universities
  "lmu münchen": "lmu.de",
  "lmu munich": "lmu.de",
  "ludwig-maximilians": "lmu.de",
  "tu münchen": "tum.de",
  "tu munich": "tum.de",
  "technische universität münchen": "tum.de",
  "heidelberg": "uni-heidelberg.de",
  "ruprecht-karls": "uni-heidelberg.de",
  "humboldt": "hu-berlin.de",
  "freie universität berlin": "fu-berlin.de",
  "fu berlin": "fu-berlin.de",
  "technische universität berlin": "tu-berlin.de",
  "tu berlin": "tu-berlin.de",
  "rwth aachen": "rwth-aachen.de",
  "freiburg": "uni-freiburg.de",
  "albert-ludwigs": "uni-freiburg.de",
  "göttingen": "uni-goettingen.de",
  "georg-august": "uni-goettingen.de",
  "bonn": "uni-bonn.de",
  "rheinische friedrich-wilhelms": "uni-bonn.de",
  "köln": "uni-koeln.de",
  "cologne": "uni-koeln.de",
  "hamburg": "uni-hamburg.de",
  "mannheim": "uni-mannheim.de",
  "tu dresden": "tu-dresden.de",
  "technische universität dresden": "tu-dresden.de",
  "tu darmstadt": "tu-darmstadt.de",
  "technische universität darmstadt": "tu-darmstadt.de",
  "stuttgart": "uni-stuttgart.de",
  "karlsruhe": "kit.edu",
  "kit": "kit.edu",
  "erlangen": "fau.de",
  "fau": "fau.de",
  "münster": "uni-muenster.de",
  "westfälische wilhelms": "uni-muenster.de",
  "tübingen": "uni-tuebingen.de",
  "eberhard karls": "uni-tuebingen.de",
  "frankfurt": "uni-frankfurt.de",
  "goethe": "uni-frankfurt.de",
  "würzburg": "uni-wuerzburg.de",
  "julius-maximilians": "uni-wuerzburg.de",
  "jena": "uni-jena.de",
  "friedrich schiller": "uni-jena.de",
  "kiel": "uni-kiel.de",
  "christian-albrechts": "uni-kiel.de",
  "düsseldorf": "hhu.de",
  "heinrich heine": "hhu.de",
  "mainz": "uni-mainz.de",
  "johannes gutenberg": "uni-mainz.de",
  "bochum": "ruhr-uni-bochum.de",
  "ruhr": "ruhr-uni-bochum.de",
  "bielefeld": "uni-bielefeld.de",
  "konstanz": "uni-konstanz.de",
  "ulm": "uni-ulm.de",
  "regensburg": "uni-regensburg.de",
  "passau": "uni-passau.de",
  "bremen": "uni-bremen.de",
  "chemnitz": "tu-chemnitz.de",
  "ilmenau": "tu-ilmenau.de",
  "clausthal": "tu-clausthal.de",
  "braunschweig": "tu-braunschweig.de",
  "carolo-wilhelmina": "tu-braunschweig.de",
  "hannover": "uni-hannover.de",
  "leibniz": "uni-hannover.de",
  "leipzig": "uni-leipzig.de",
  "rostock": "uni-rostock.de",
  "potsdam": "uni-potsdam.de",
  "greifswald": "uni-greifswald.de",
  "siegen": "uni-siegen.de",
  "paderborn": "uni-paderborn.de",
  "kassel": "uni-kassel.de",
  "wuppertal": "uni-wuppertal.de",
  "bergische": "uni-wuppertal.de",
  "duisburg": "uni-due.de",
  "essen": "uni-due.de",
  "osnabrück": "uni-osnabrueck.de",
  "bayreuth": "uni-bayreuth.de",
  "augsburg": "uni-augsburg.de",
  "marburg": "uni-marburg.de",
  "philipps": "uni-marburg.de",
  "giessen": "uni-giessen.de",
  "justus-liebig": "uni-giessen.de",
  "halle": "uni-halle.de",
  "martin-luther": "uni-halle.de",
  "magdeburg": "ovgu.de",
  "otto von guericke": "ovgu.de",
  "cottbus": "b-tu.de",
  "brandenburg": "b-tu.de",
  "saarbrücken": "uni-saarland.de",
  "saarland": "uni-saarland.de",
  "trier": "uni-trier.de",
  "oldenburg": "uni-oldenburg.de",
  "hildesheim": "uni-hildesheim.de",
  "bamberg": "uni-bamberg.de",
  "lüneburg": "leuphana.de",
  "leuphana": "leuphana.de",
  "dortmund": "tu-dortmund.de",
  "kaiserslautern": "rptu.de",
  "hohenheim": "uni-hohenheim.de",
  "erfurt": "uni-erfurt.de",
  "vechta": "uni-vechta.de",
  "flensburg": "uni-flensburg.de",
  
  // German Universities of Applied Sciences (Hochschulen)
  "hochschule münchen": "hm.edu",
  "hochschule berlin": "htw-berlin.de",
  "htw berlin": "htw-berlin.de",
  "hwr berlin": "hwr-berlin.de",
  "beuth": "beuth-hochschule.de",
  "bht berlin": "bht-berlin.de",
  "berliner hochschule": "bht-berlin.de",
  "hochschule darmstadt": "h-da.de",
  "h-da": "h-da.de",
  "hochschule hannover": "hs-hannover.de",
  "hochschule esslingen": "hs-esslingen.de",
  "hochschule karlsruhe": "h-ka.de",
  "hka": "h-ka.de",
  "hochschule bremen": "hs-bremen.de",
  "hsb": "hs-bremen.de",
  "hochschule bielefeld": "hsbi.de",
  "fh bielefeld": "hsbi.de",
  "hochschule rheinmain": "hs-rm.de",
  "hochschule mainz": "hs-mainz.de",
  "hochschule fulda": "hs-fulda.de",
  "hochschule furtwangen": "hs-furtwangen.de",
  "hfu": "hs-furtwangen.de",
  "hochschule bochum": "hs-bochum.de",
  "fh aachen": "fh-aachen.de",
  "hochschule emden": "hs-emden-leer.de",
  "hochschule fresenius": "hs-fresenius.de",
  "hochschule stuttgart": "hft-stuttgart.de",
  "htw saar": "htw-saarland.de",
  "deggendorf": "th-deg.de",
  "heilbronn": "hs-heilbronn.de",
  "hochschule coburg": "hs-coburg.de",
  "hochschule anhalt": "hs-anhalt.de",
  "hochschule mittweida": "hs-mittweida.de",
  "hochschule kempten": "hs-kempten.de",
  "hochschule landshut": "haw-landshut.de",
  "hochschule regensburg": "oth-regensburg.de",
  "hochschule augsburg": "hs-augsburg.de",
  "hochschule rosenheim": "th-rosenheim.de",
  "hochschule würzburg": "thws.de",
  
  // German Business/Medical Schools
  "escp": "escp.eu",
  "esmt": "esmt.org",
  "frankfurt school": "fs.de",
  "hhl": "hhl.de",
  "hhl leipzig": "hhl.de",
  "hertie": "hertie-school.org",
  "hertie school": "hertie-school.org",
  "mannheim business": "mannheim-business-school.com",
  "cbs": "cbs.de",
  "cbs international": "cbs.de",
  "gisma": "gisma.com",
  "jacobs": "jacobs-university.de",
  "constructor": "constructor.university",
  "bard college berlin": "berlin.bard.edu",
  "european university viadrina": "europa-uni.de",
  "viadrina": "europa-uni.de",
  "iu international": "iu.de",
  "iubh": "iu.de",
  "charité": "charite.de",
  "charite": "charite.de",
  "hannover medical": "mhh.de",
  "medizinische hochschule hannover": "mhh.de",
  "bauhaus": "uni-weimar.de",
  "weimar": "uni-weimar.de",
  
  // ===================== Russia =====================
  "moscow state": "msu.ru",
  "lomonosov": "msu.ru",
  "mgu": "msu.ru",
  "msu": "msu.ru",
  "hse": "hse.ru",
  "higher school of economics": "hse.ru",
  "itmo": "itmo.ru",
  "bauman": "bmstu.ru",
  "bmstu": "bmstu.ru",
  "spbstu": "spbstu.ru",
  "polytechnic": "spbstu.ru",
  "peter the great": "spbstu.ru",
  "kazan federal": "kpfu.ru",
  "kfu": "kpfu.ru",
  "novosibirsk": "nsu.ru",
  "nsu": "nsu.ru",
  "rudn": "rudn.ru",
  "peoples' friendship": "rudn.ru",
  "friendship": "rudn.ru",
  "tomsk state": "tsu.ru",
  "tomsk": "tsu.ru",
  "ural federal": "urfu.ru",
  "urfu": "urfu.ru",
  "samara": "ssau.ru",
  "st petersburg state": "spbu.ru",
  "saint petersburg state": "spbu.ru",
  "spbu": "spbu.ru",
  "misis": "misis.ru",
  "mipt": "mipt.ru",
  "phystech": "mipt.ru",
  "moscow institute of physics": "mipt.ru",
  "sechenov": "sechenov.ru",
  "first moscow medical": "sechenov.ru",
  "pavlov": "1spbgmu.ru",
  "saint petersburg medical": "1spbgmu.ru",
  "kazan medical": "kazangmu.ru",
  "pirogov": "rsmu.ru",
  "national research medical": "rsmu.ru",
  "far eastern federal": "dvfu.ru",
  "dvfu": "dvfu.ru",
  "southern federal": "sfedu.ru",
  "rostov": "sfedu.ru",
  "siberian federal": "sfu-kras.ru",
  "krasnoyarsk": "sfu-kras.ru",
  "tomsk polytechnic": "tpu.ru",
  "tpu": "tpu.ru",
  "нижегородский": "unn.ru",
  "lobachevsky": "unn.ru",
  "سانت بطرسبرغ": "spbu.ru",
  "موسكو الحكومية": "msu.ru",
  "قازان الفيدرالية": "kpfu.ru",
  "قازان الطبية": "kazangmu.ru",
  "بيروغوف": "rsmu.ru",
  "سيتشينوف": "sechenov.ru",
  "بافلوف": "1spbgmu.ru",
  "الصداقة بين الشعوب": "rudn.ru",
  
  // ===================== Turkey =====================
  "boğaziçi": "boun.edu.tr",
  "bogazici": "boun.edu.tr",
  "bosphorus": "boun.edu.tr",
  "metu": "metu.edu.tr",
  "middle east technical": "metu.edu.tr",
  "الشرق الأوسط التقنية": "metu.edu.tr",
  "istanbul university": "istanbul.edu.tr",
  "istanbul üniversitesi": "istanbul.edu.tr",
  "bilkent": "bilkent.edu.tr",
  "koç": "ku.edu.tr",
  "koc": "ku.edu.tr",
  "sabancı": "sabanciuniv.edu",
  "sabanci": "sabanciuniv.edu",
  "hacettepe": "hacettepe.edu.tr",
  "ankara university": "ankara.edu.tr",
  "istanbul technical": "itu.edu.tr",
  "itu": "itu.edu.tr",
  "yıldız": "yildiz.edu.tr",
  "marmara": "marmara.edu.tr",
  "galatasaray": "gsu.edu.tr",
  "özyeğin": "ozyegin.edu.tr",
  "bahçeşehir": "bau.edu.tr",
  "kadir has": "khas.edu.tr",
  
  // ===================== Switzerland =====================
  "eth zurich": "ethz.ch",
  "eth zürich": "ethz.ch",
  "زيورخ": "ethz.ch",
  "epfl": "epfl.ch",
  "lausanne": "epfl.ch",
  "university of zurich": "uzh.ch",
  "zurich": "uzh.ch",
  "basel": "unibas.ch",
  "bern": "unibe.ch",
  "geneva": "unige.ch",
  "st. gallen": "unisg.ch",
  "gallen": "unisg.ch",
  "imd": "imd.org",
  
  // ===================== Canada =====================
  "toronto": "utoronto.ca",
  "mcgill": "mcgill.ca",
  "ubc": "ubc.ca",
  "british columbia": "ubc.ca",
  "waterloo": "uwaterloo.ca",
  "alberta": "ualberta.ca",
  "montreal": "umontreal.ca",
  "mcmaster": "mcmaster.ca",
  "queen's": "queensu.ca",
  "queens": "queensu.ca",
  "western": "uwo.ca",
  "ottawa": "uottawa.ca",
  "calgary": "ucalgary.ca",
  "simon fraser": "sfu.ca",
  "sfu": "sfu.ca",
  "dalhousie": "dal.ca",
  "victoria": "uvic.ca",
  "laval": "ulaval.ca",
  "concordia": "concordia.ca",
  "york university": "yorku.ca",
  "carleton": "carleton.ca",
  "manitoba": "umanitoba.ca",
  "saskatchewan": "usask.ca",
  "guelph": "uoguelph.ca",
  "memorial": "mun.ca",
  "acadia": "acadiau.ca",
  "bishop's": "ubishops.ca",
  "humber": "humber.ca",
  
  // ===================== Australia =====================
  "melbourne": "unimelb.edu.au",
  "sydney": "sydney.edu.au",
  "unsw": "unsw.edu.au",
  "new south wales": "unsw.edu.au",
  "queensland": "uq.edu.au",
  "anu": "anu.edu.au",
  "australian national": "anu.edu.au",
  "monash": "monash.edu",
  "western australia": "uwa.edu.au",
  "adelaide": "adelaide.edu.au",
  "auckland": "auckland.ac.nz",
  "aut": "aut.ac.nz",
  
  // ===================== Netherlands =====================
  "amsterdam": "uva.nl",
  "delft": "tudelft.nl",
  "tu delft": "tudelft.nl",
  "leiden": "universiteitleiden.nl",
  "utrecht": "uu.nl",
  "rotterdam": "eur.nl",
  "erasmus": "eur.nl",
  "groningen": "rug.nl",
  "eindhoven": "tue.nl",
  "tu eindhoven": "tue.nl",
  "maastricht": "maastrichtuniversity.nl",
  "tilburg": "tilburguniversity.edu",
  "wageningen": "wur.nl",
  "twente": "utwente.nl",
  "nijmegen": "ru.nl",
  "radboud": "ru.nl",
  "vrije": "vu.nl",
  "vu amsterdam": "vu.nl",
  
  // ===================== France =====================
  "sorbonne": "sorbonne-universite.fr",
  "paris-saclay": "universite-paris-saclay.fr",
  "psl": "psl.eu",
  "hec paris": "hec.edu",
  "insead": "insead.edu",
  "sciences po": "sciencespo.fr",
  "polytechnique": "polytechnique.edu",
  "centrale": "centralesupelec.fr",
  "ens": "ens.fr",
  "normale supérieure": "ens.fr",
  
  // ===================== Japan =====================
  "tokyo": "u-tokyo.ac.jp",
  "kyoto": "kyoto-u.ac.jp",
  "osaka": "osaka-u.ac.jp",
  "tohoku": "tohoku.ac.jp",
  "nagoya": "nagoya-u.ac.jp",
  "kyushu": "kyushu-u.ac.jp",
  "hokkaido": "hokudai.ac.jp",
  "keio": "keio.ac.jp",
  "waseda": "waseda.jp",
  "titech": "titech.ac.jp",
  "tokyo institute": "titech.ac.jp",
  
  // ===================== China =====================
  "tsinghua": "tsinghua.edu.cn",
  "peking": "pku.edu.cn",
  "fudan": "fudan.edu.cn",
  "zhejiang": "zju.edu.cn",
  "shanghai jiao tong": "sjtu.edu.cn",
  "nanjing": "nju.edu.cn",
  "wuhan": "whu.edu.cn",
  "xiamen": "xmu.edu.cn",
  
  // ===================== Singapore =====================
  "nus": "nus.edu.sg",
  "national university of singapore": "nus.edu.sg",
  "ntu singapore": "ntu.edu.sg",
  "nanyang": "ntu.edu.sg",
  "smu": "smu.edu.sg",
  
  // ===================== Hong Kong =====================
  "hong kong": "hku.hk",
  "hku": "hku.hk",
  "cuhk": "cuhk.edu.hk",
  "chinese university": "cuhk.edu.hk",
  "hkust": "ust.hk",
  
  // ===================== Ireland =====================
  "trinity": "tcd.ie",
  "trinity college dublin": "tcd.ie",
  "ucd": "ucd.ie",
  "university college dublin": "ucd.ie",
  "galway": "universityofgalway.ie",
  "cork": "ucc.ie",
  "limerick": "ul.ie",
  "dcu": "dcu.ie",
  
  // ===================== Spain =====================
  "barcelona": "ub.edu",
  "autonoma madrid": "uam.es",
  "autónoma madrid": "uam.es",
  "complutense": "ucm.es",
  "iese": "iese.edu",
  "ie business": "ie.edu",
  "esade": "esade.edu",
  
  // ===================== Italy =====================
  "bocconi": "unibocconi.eu",
  "bologna": "unibo.it",
  "padova": "unipd.it",
  "politecnico milano": "polimi.it",
  "politecnico torino": "polito.it",
  "sapienza": "uniroma1.it",
  
  // ===================== Austria =====================
  "vienna": "univie.ac.at",
  "tu wien": "tuwien.ac.at",
  "graz": "uni-graz.at",
  "innsbruck": "uibk.ac.at",
  
  // ===================== Belgium =====================
  "leuven": "kuleuven.be",
  "ku leuven": "kuleuven.be",
  "ghent": "ugent.be",
  "vub": "vub.be",
  "libre bruxelles": "ulb.be",
  
  // ===================== Sweden =====================
  "lund": "lu.se",
  "uppsala": "uu.se",
  "stockholm": "su.se",
  "kth": "kth.se",
  "gothenburg": "gu.se",
  "chalmers": "chalmers.se",
  "linköping": "liu.se",
  
  // ===================== Denmark =====================
  "copenhagen": "ku.dk",
  "aarhus": "au.dk",
  "dtu": "dtu.dk",
  "technical university of denmark": "dtu.dk",
  "cbs copenhagen": "cbs.dk",
  
  // ===================== Norway =====================
  "oslo": "uio.no",
  "ntnu": "ntnu.no",
  "norwegian": "ntnu.no",
  "bergen": "uib.no",
  
  // ===================== Finland =====================
  "helsinki": "helsinki.fi",
  "aalto": "aalto.fi",
  "turku": "utu.fi",
  
  // ===================== Poland =====================
  "warsaw": "uw.edu.pl",
  "jagiellonian": "uj.edu.pl",
  "krakow": "uj.edu.pl",
  "agh": "agh.edu.pl",
  
  // ===================== Czech Republic =====================
  "charles": "cuni.cz",
  "prague": "cuni.cz",
  "cvut": "cvut.cz",
  "czech technical": "cvut.cz",
  
  // ===================== South Korea =====================
  "seoul national": "snu.ac.kr",
  "snu": "snu.ac.kr",
  "kaist": "kaist.ac.kr",
  "korea university": "korea.ac.kr",
  "yonsei": "yonsei.ac.kr",
  "postech": "postech.ac.kr",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body = await req.json().catch(() => ({}));
    const { action = "fetch-missing", limit = 50, universityId } = body;

    // Single university mode
    if (action === "fetch-single" && universityId) {
      const { data: uni } = await supabase
        .from("universities")
        .select("id, name, website")
        .eq("id", universityId)
        .single();

      if (!uni) {
        return new Response(
          JSON.stringify({ error: "University not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await fetchLogo(supabase, uni);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch mode - fetch missing logos
    const { data: universities, error } = await supabase
      .from("universities")
      .select("id, name, website")
      .or("logo_url.is.null,logo_url.ilike.%example.com%,logo_url.ilike.%clearbit%,logo_url.ilike.%placeholder%")
      .limit(limit);

    if (error) {
      console.error("Error fetching universities:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${universities?.length || 0} universities without proper logos`);

    const results = [];
    for (const uni of universities || []) {
      const result = await fetchLogo(supabase, uni);
      results.push(result);
      // Small delay between requests
      await new Promise((r) => setTimeout(r, 200));
    }

    // Count remaining
    const { count: remaining } = await supabase
      .from("universities")
      .select("id", { count: "exact", head: true })
      .or("logo_url.is.null,logo_url.ilike.%example.com%,logo_url.ilike.%clearbit%,logo_url.ilike.%placeholder%");

    return new Response(
      JSON.stringify({ 
        processed: results.length, 
        successful: results.filter(r => r.success).length,
        results,
        remaining
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function fetchLogo(
  supabase: any,
  university: { id: string; name: string; website?: string }
): Promise<{ id: string; name: string; success: boolean; logo_url?: string; error?: string }> {
  try {
    console.log(`Processing: ${university.name}`);
    const nameLower = university.name.toLowerCase();
    
    // Try to find domain from our mapping - check multiple keywords
    let domain = "";
    const nameWords = nameLower.split(/[\s,\-()]+/);
    
    // First try exact matches for longer keys
    const sortedKeys = Object.keys(UNIVERSITY_DOMAINS).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (nameLower.includes(key)) {
        domain = UNIVERSITY_DOMAINS[key];
        break;
      }
    }
    
    // If not found in mapping, try to extract from website
    if (!domain && university.website) {
      try {
        const url = new URL(university.website.startsWith("http") ? university.website : `https://${university.website}`);
        domain = url.hostname.replace("www.", "");
      } catch {
        // Invalid URL
      }
    }

    if (!domain) {
      console.log(`No domain found for ${university.name}`);
      return { id: university.id, name: university.name, success: false, error: "No domain mapping" };
    }

    // Use Clearbit Logo API
    const logoUrl = `https://logo.clearbit.com/${domain}`;
    
    // Verify the logo exists
    try {
      const response = await fetch(logoUrl, { method: "HEAD" });
      if (!response.ok) {
        console.log(`Clearbit logo not found for ${domain}`);
        
        // Try favicon as fallback
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        const { error: updateError } = await supabase
          .from("universities")
          .update({ logo_url: faviconUrl })
          .eq("id", university.id);
        
        if (updateError) {
          return { id: university.id, name: university.name, success: false, error: "DB update failed" };
        }
        
        console.log(`✅ Favicon set for ${university.name}: ${faviconUrl}`);
        return { id: university.id, name: university.name, success: true, logo_url: faviconUrl };
      }
    } catch {
      console.log(`Failed to check ${logoUrl}`);
      return { id: university.id, name: university.name, success: false, error: "Logo check failed" };
    }

    // Update university with Clearbit URL
    const { error: updateError } = await supabase
      .from("universities")
      .update({ logo_url: logoUrl })
      .eq("id", university.id);

    if (updateError) {
      console.error(`Update error for ${university.name}:`, updateError);
      return { id: university.id, name: university.name, success: false, error: "DB update failed" };
    }

    console.log(`✅ Logo updated for ${university.name}: ${logoUrl}`);
    return { id: university.id, name: university.name, success: true, logo_url: logoUrl };
  } catch (err: unknown) {
    console.error(`Error processing ${university.name}:`, err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return { id: university.id, name: university.name, success: false, error: message };
  }
}
