/**
 * تحويل النص المنظم للجامعات والبرامج إلى JSON
 */

interface ProgramData {
  university_name: string;
  program_name: string;
  degree_level: string;
  tuition_fee?: number;
  currency?: string;
  academic_year?: string;
  language: string;
  ielts_requirement?: string;
  academic_requirements?: string;
  pathway_available?: string;
  country: string;
}

export function parseStructuredUniversityData(text: string): ProgramData[] {
  const programs: ProgramData[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  let currentCountry = '';
  let currentUniversity = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect country headers (starts with #)
    if (line.startsWith('# ') && !line.startsWith('##')) {
      currentCountry = line.replace('# ', '').trim();
      continue;
    }
    
    // Detect university headers (starts with **)
    if (line.startsWith('**') && line.endsWith('**')) {
      currentUniversity = line.replace(/\*\*/g, '').trim();
      continue;
    }
    
    // Detect program lines (starts with *)
    if (line.startsWith('* ') && currentCountry && currentUniversity) {
      const program = parseProgramLine(line, currentCountry, currentUniversity);
      if (program) {
        programs.push(program);
      }
    }
  }
  
  return programs;
}

function parseProgramLine(line: string, country: string, university: string): ProgramData | null {
  try {
    // Remove leading "* "
    const content = line.substring(2);
    
    // Split by " — " to get parts
    const parts = content.split(' — ').map(p => p.trim());
    
    if (parts.length < 2) return null;
    
    const program: ProgramData = {
      university_name: university,
      program_name: parts[0],
      degree_level: parts[1] || 'غير محدد',
      language: 'غير محدد',
      country: country
    };
    
    // Parse optional fields
    for (let i = 2; i < parts.length; i++) {
      const part = parts[i];
      
      // Tuition fee (contains numbers and currency)
      if (/\d+[,\d]*\s*(USD|EUR|GBP|CAD|AUD)/i.test(part)) {
        const match = part.match(/(\d+[,\d]*)\s*(USD|EUR|GBP|CAD|AUD)/i);
        if (match) {
          program.tuition_fee = parseFloat(match[1].replace(/,/g, ''));
          program.currency = match[2].toUpperCase();
          
          // Extract academic year if present (2025)
          const yearMatch = part.match(/\((\d{4})\)/);
          if (yearMatch) {
            program.academic_year = yearMatch[1];
          }
        }
      }
      
      // Language
      else if (part.includes('الإنجليزية') || part.includes('الإنجليزي') || part.toLowerCase().includes('english')) {
        program.language = 'الإنجليزية';
      }
      
      // IELTS requirement
      else if (part.includes('IELTS')) {
        program.ielts_requirement = part;
      }
      
      // Pathway
      else if (part.includes('المسار:') || part.includes('مسار')) {
        program.pathway_available = part;
      }
      
      // Academic requirements
      else if (part.includes('متطلبات أكاديمية:')) {
        program.academic_requirements = part;
      }
    }
    
    return program;
  } catch (error) {
    console.error('Error parsing program line:', line, error);
    return null;
  }
}

/**
 * تحويل JSON إلى نص منسق للمراجعة
 */
export function formatProgramsToText(programs: ProgramData[]): string {
  const byCountry: Record<string, Record<string, ProgramData[]>> = {};
  
  // Group by country and university
  for (const prog of programs) {
    if (!byCountry[prog.country]) {
      byCountry[prog.country] = {};
    }
    if (!byCountry[prog.country][prog.university_name]) {
      byCountry[prog.country][prog.university_name] = [];
    }
    byCountry[prog.country][prog.university_name].push(prog);
  }
  
  let text = '';
  
  for (const [country, universities] of Object.entries(byCountry)) {
    text += `\n# ${country}\n\n`;
    
    for (const [university, progs] of Object.entries(universities)) {
      text += `**${university}**\n\n`;
      
      for (const prog of progs) {
        text += `* ${prog.program_name}`;
        text += ` — ${prog.degree_level}`;
        if (prog.tuition_fee && prog.currency) {
          text += ` — ${prog.tuition_fee.toLocaleString()} ${prog.currency}`;
          if (prog.academic_year) text += ` (${prog.academic_year})`;
        }
        text += ` — ${prog.language}`;
        if (prog.ielts_requirement) text += ` — ${prog.ielts_requirement}`;
        if (prog.academic_requirements) text += ` — ${prog.academic_requirements}`;
        if (prog.pathway_available) text += ` — ${prog.pathway_available}`;
        text += '\n';
      }
      text += '\n';
    }
  }
  
  return text;
}
