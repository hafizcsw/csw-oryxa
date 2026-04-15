const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractUniversity(md: string) {
  const rankMatch = md.match(/QS World University Rankings.*?#?(\d+)/i) || md.match(/Ranked\s+#?(\d+)/i) || md.match(/World Rank[^\d]*(\d+)/i);
  const aboutMatch = md.match(/(?:^|\n)##?\s*About[^\n]*\n+([\s\S]{50,500}?)(?:\n#|\n\n\n)/i);
  const websiteMatch = md.match(/(?:Official\s+)?(?:Website|Site)\s*[:\-]?\s*(https?:\/\/[^\s\)]+)/i)
    || md.match(/\[(?:Visit\s+)?(?:website|site|official)\]\((https?:\/\/[^\)]+)\)/i);
  const progMatches = md.match(/(?:Master|Bachelor|PhD|MSc|MA|MBA|BSc|BA|MPhil|DPhil)\s+(?:of|in|:)\s+/gi);

  // Students/staff
  const studentsMatch = md.match(/(\d[\d,]+)\s*(?:total\s+)?students/i);
  const staffMatch = md.match(/(\d[\d,]+)\s*(?:academic\s+)?(?:staff|faculty)/i);
  const intlStudents = md.match(/(\d[\d,.]+)\s*%?\s*international\s+students/i);

  // Cost of living
  const livingMatch = md.match(/(?:cost\s+of\s+living|living\s+costs?)[^\n]*[\s\S]{0,300}/i);

  // Campus/locations
  const campusMatch = md.match(/(?:campus|location|campuses)[^\n]*[\s\S]{0,200}/i);

  // Media (video/image mentions)
  const hasVideo = /youtube|vimeo|video/i.test(md);
  const imageCount = (md.match(/!\[/g) || []).length;

  // FAQs
  const faqSection = md.match(/(?:FAQ|Frequently\s+Asked)[^\n]*[\s\S]{0,500}/i);

  // Employability
  const employMatch = md.match(/(?:Employability|Employment|Career|Graduate\s+outcomes?)[^\n]*[\s\S]{0,300}/i);

  // Admissions section
  const admSection = md.match(/(?:Admission|Entry\s+Requirements?|How\s+to\s+Apply)[^\n]*[\s\S]{0,300}/i);

  return {
    world_rank: rankMatch ? parseInt(rankMatch[1]) : "NOT_FOUND",
    about_text_exists: !!aboutMatch,
    about_text_preview: aboutMatch ? aboutMatch[1].slice(0, 200) : "NOT_FOUND",
    official_website: websiteMatch ? websiteMatch[1] : "NOT_FOUND",
    programme_count: progMatches ? progMatches.length : 0,
    students_staff: {
      total_students: studentsMatch ? studentsMatch[1] : "NOT_FOUND",
      staff: staffMatch ? staffMatch[1] : "NOT_FOUND",
      international_students: intlStudents ? intlStudents[1] : "NOT_FOUND",
    },
    cost_of_living: livingMatch ? livingMatch[0].slice(0, 200) : "NOT_FOUND",
    campus_locations: campusMatch ? campusMatch[0].slice(0, 200) : "NOT_FOUND",
    media: { has_video: hasVideo, image_count: imageCount },
    faqs: faqSection ? faqSection[0].slice(0, 300) : "NOT_FOUND",
    employability: employMatch ? employMatch[0].slice(0, 200) : "NOT_FOUND",
    admissions: admSection ? admSection[0].slice(0, 200) : "NOT_FOUND",
  };
}

function extractProgram(md: string) {
  const titleMatch = md.match(/^#\s+(.+?)$/m);
  const degreeMatch = md.match(/(MSc|MA|MBA|MPhil|BSc|BA|BBA|PhD|DPhil|Master|Bachelor)\s/i);
  const durationMatch = md.match(/(?:Duration|Length)[:\s]*([^\n]{3,80})/i)
    || md.match(/(\d+)\s*(?:year|month|semester|week)s?/i);
  const studyModeMatch = md.match(/(?:Study\s+Mode|Mode\s+of\s+Study|Attendance)[:\s]*(Full[\s-]?time|Part[\s-]?time|Online|Distance|Blended)/i)
    || md.match(/(Full[\s-]?time|Part[\s-]?time)/i);

  // Tuition
  const tuitionSection = md.match(/(?:Tuition|Fee|Cost)[s]?[\s\S]{0,800}/i)?.[0] || "";
  const domesticMatch = tuitionSection.match(/(?:domestic|home|local|UK)[^\d]*?([£€$]?\s*[\d,]+)/i);
  const intlMatch = tuitionSection.match(/(?:international|overseas|foreign)[^\d]*?([£€$]?\s*[\d,]+)/i);
  const currencyMatch = md.match(/[£€$]|GBP|EUR|USD|AED/);

  // Start months
  const startMatch = md.match(/(?:Start(?:s|ing)?|Intake|Commence)[:\s]*([^\n]{3,80})/i);

  // Deadline
  const deadlineMatch = md.match(/(?:Deadline|Application\s+Due|Apply\s+by|Closing\s+Date)[:\s]*([^\n]{3,80})/i);

  // Admission requirements
  const admMatch = md.match(/(?:Admission|Entry|Requirement|Eligib|IELTS|TOEFL|GPA)[^\n]*[\s\S]{0,400}/i);

  // Subject area
  const subjectMatch = md.match(/(?:Subject\s+Area|Discipline|Field|Department)[:\s]*([^\n]{3,80})/i);

  const levelMap = (d: string) => {
    const l = d.toLowerCase();
    if (["msc","ma","mba","mphil","master"].some(x => l.startsWith(x))) return "master";
    if (["bsc","ba","bba","bachelor"].some(x => l.startsWith(x))) return "bachelor";
    return "phd";
  };

  return {
    title: titleMatch ? titleMatch[1].trim() : "NOT_FOUND",
    degree: degreeMatch ? degreeMatch[1] : "NOT_FOUND",
    level: degreeMatch ? levelMap(degreeMatch[1]) : "NOT_FOUND",
    duration: durationMatch ? durationMatch[0].trim() : "NOT_FOUND",
    study_mode: studyModeMatch ? studyModeMatch[1] || studyModeMatch[0] : "NOT_FOUND",
    tuition_domestic: domesticMatch ? domesticMatch[1] : "NOT_FOUND",
    tuition_international: intlMatch ? intlMatch[1] : "NOT_FOUND",
    tuition_currency: currencyMatch ? currencyMatch[0] : "NOT_FOUND",
    start_months: startMatch ? startMatch[1].trim() : "NOT_FOUND",
    deadline_raw: deadlineMatch ? deadlineMatch[1].trim() : "NOT_FOUND",
    admission_requirements: admMatch ? admMatch[0].slice(0, 400) : "NOT_FOUND",
    subject_area: subjectMatch ? subjectMatch[1].trim() : "NOT_FOUND",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { url, extract_type } = await req.json();
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "no key" }), { status: 500, headers: corsHeaders });

  try {
    const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], waitFor: 5000, onlyMainContent: false }),
      signal: AbortSignal.timeout(60000),
    });
    const body = await r.json();
    if (!r.ok) return new Response(JSON.stringify({ error: body?.error, status: r.status }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const md = body.data?.markdown || "";
    const lines = md.split("\n");

    const extraction = extract_type === "university" ? extractUniversity(md) : extractProgram(md);

    return new Response(JSON.stringify({
      fetch_proof: {
        fetch_method: "firecrawl",
        has_markdown: md.length > 500,
        raw_markdown_length: md.length,
        total_lines: lines.length,
        first_25_lines: lines.slice(0, 25),
      },
      extraction_proof: extraction,
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
