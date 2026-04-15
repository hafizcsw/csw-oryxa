export const UNIVERSITY_BOT_SCHEMA = {
  $id: "university_bot_schema",
  type: "object",
  properties: {
    universities: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "name_en", "country"],
        properties: {
          name: { type: "string" },
          name_en: { type: "string" },
          slug: { type: "string" },
          country: { type: "string" },
          country_code: { type: "string" },
          city: { type: "string" },
          logo_url: { type: "string" },
          hero_image_url: { type: "string" },
          ranking: { type: "integer" },
          website_url: { type: "string" },
          description: { type: "string" },
          source_urls: { type: "array", items: { type: "string" } },
          confidence_score: { type: "number", minimum: 0, maximum: 1 }
        },
        additionalProperties: false
      }
    },
    programs: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "university_name"],
        properties: {
          university_name: { type: "string" },
          title: { type: "string" },
          title_en: { type: "string" },
          program_slug: { type: "string" },
          degree_level: {
            type: "string",
            enum: ["associate","bachelor","master","phd","diploma","certificate","other"]
          },
          language: { type: "string" },
          duration_months: { type: "integer", minimum: 1 },
          tuition_fee: { type: "number", minimum: 0 },
          currency: { type: "string" },
          application_fee: { type: "number", minimum: 0 },
          intake_months: { type: "array", items: { type: "string" } },
          requirements: { type: "array", items: { type: "string" } },
          source_url: { type: "string" },
          confidence_score: { type: "number", minimum: 0, maximum: 1 }
        },
        additionalProperties: false
      }
    },
    scholarships: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "university_name"],
        properties: {
          university_name: { type: "string" },
          name: { type: "string" },
          coverage: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string" },
          deadline: { type: "string" },
          eligibility: { type: "array", items: { type: "string" } },
          source_url: { type: "string" },
          confidence_score: { type: "number", minimum: 0, maximum: 1 }
        },
        additionalProperties: false
      }
    }
  },
  required: ["universities", "programs"],
  additionalProperties: false
} as const;
