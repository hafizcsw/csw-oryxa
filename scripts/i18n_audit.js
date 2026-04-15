#!/usr/bin/env node
/**
 * i18n_audit.js - Translation Usage Audit Script
 * 
 * Scans all TypeScript/TSX files in src/ to find:
 * - Literal t("key") calls
 * - Dynamic t(variable) calls
 * - Unused keys in dictionaries
 * - Missing keys referenced in code
 * 
 * Output: translation-audit.json
 */

const fs = require('fs');
const path = require('path');

// ========== Configuration ==========
const SRC_DIR = path.join(__dirname, '..', 'src');
const CONTEXT_FILE = path.join(SRC_DIR, 'contexts', 'LanguageContext.tsx');
const OUTPUT_FILE = path.join(__dirname, '..', 'translation-audit.json');

// ========== Utility Functions ==========

function getAllFiles(dir, extensions = ['.ts', '.tsx']) {
  let results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      // Skip node_modules and hidden folders
      if (!item.name.startsWith('.') && item.name !== 'node_modules') {
        results = results.concat(getAllFiles(fullPath, extensions));
      }
    } else if (extensions.some(ext => item.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractDictionaryKeys(contextContent) {
  // Find all languages and their keys
  const languages = {};
  
  // Match language blocks: en: { ... }, ar: { ... }, etc.
  const langBlockRegex = /\b(en|ar|fr|ru|es|zh)\s*:\s*\{/g;
  let match;
  
  while ((match = langBlockRegex.exec(contextContent)) !== null) {
    const lang = match[1];
    const startIdx = match.index + match[0].length;
    
    // Find matching closing brace
    let braceCount = 1;
    let endIdx = startIdx;
    
    while (braceCount > 0 && endIdx < contextContent.length) {
      if (contextContent[endIdx] === '{') braceCount++;
      if (contextContent[endIdx] === '}') braceCount--;
      endIdx++;
    }
    
    const blockContent = contextContent.slice(startIdx, endIdx - 1);
    
    // Extract keys from this block
    const keyRegex = /["']([^"']+)["']\s*:/g;
    const keys = [];
    let keyMatch;
    
    while ((keyMatch = keyRegex.exec(blockContent)) !== null) {
      keys.push(keyMatch[1]);
    }
    
    languages[lang] = keys;
  }
  
  return languages;
}

function scanFileForTranslations(filePath, content) {
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  const literalKeys = [];
  const dynamicCalls = [];
  
  // Skip LanguageContext.tsx itself
  if (filePath.includes('LanguageContext.tsx')) {
    return { literalKeys, dynamicCalls };
  }
  
  // Pattern 1: Literal t("key") or t('key')
  const literalRegex = /\bt\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  let match;
  
  while ((match = literalRegex.exec(content)) !== null) {
    literalKeys.push({
      key: match[1],
      file: relativePath,
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  // Pattern 2: Dynamic t(variable) - t() with non-string argument
  // Look for t( followed by something that's not a quote
  const dynamicRegex = /\bt\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*|\?\.|\[[^\]]+\])*(?:\s*\|\|\s*["'][^"']+["'])?)\s*\)/g;
  
  while ((match = dynamicRegex.exec(content)) !== null) {
    const arg = match[1].trim();
    // Skip if it looks like a template literal or string
    if (!arg.startsWith('"') && !arg.startsWith("'") && !arg.startsWith('`')) {
      dynamicCalls.push({
        expression: arg,
        file: relativePath,
        line: content.substring(0, match.index).split('\n').length,
        snippet: content.substring(Math.max(0, match.index - 20), match.index + match[0].length + 20).replace(/\n/g, ' ').trim()
      });
    }
  }
  
  return { literalKeys, dynamicCalls };
}

// ========== Main Execution ==========

console.log('🔍 i18n Translation Audit\n');

// 1. Read LanguageContext.tsx
console.log('📖 Reading LanguageContext.tsx...');
if (!fs.existsSync(CONTEXT_FILE)) {
  console.error('❌ LanguageContext.tsx not found!');
  process.exit(1);
}

const contextContent = fs.readFileSync(CONTEXT_FILE, 'utf8');
const dictionaryKeys = extractDictionaryKeys(contextContent);

console.log('  Languages found:', Object.keys(dictionaryKeys).join(', '));
for (const [lang, keys] of Object.entries(dictionaryKeys)) {
  console.log(`    ${lang}: ${keys.length} keys`);
}

// Use 'en' as the reference (most complete)
const referenceKeys = new Set(dictionaryKeys.en || []);
console.log(`  Reference (en): ${referenceKeys.size} keys\n`);

// 2. Scan all source files
console.log('🔎 Scanning source files...');
const sourceFiles = getAllFiles(SRC_DIR);
console.log(`  Found ${sourceFiles.length} files\n`);

const allLiteralKeys = [];
const allDynamicCalls = [];

for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const { literalKeys, dynamicCalls } = scanFileForTranslations(file, content);
  allLiteralKeys.push(...literalKeys);
  allDynamicCalls.push(...dynamicCalls);
}

// 3. Analyze results
console.log('📊 Analyzing usage...\n');

const usedLiteralKeySet = new Set(allLiteralKeys.map(k => k.key));
const unusedKeys = [...referenceKeys].filter(k => !usedLiteralKeySet.has(k));
const missingKeys = [...usedLiteralKeySet].filter(k => !referenceKeys.has(k));

// Group by file for better reporting
const usageByFile = {};
for (const item of allLiteralKeys) {
  if (!usageByFile[item.file]) {
    usageByFile[item.file] = [];
  }
  usageByFile[item.file].push(item.key);
}

// 4. Generate report
const report = {
  generated_at: new Date().toISOString(),
  summary: {
    total_dictionary_keys: referenceKeys.size,
    total_literal_calls: allLiteralKeys.length,
    unique_literal_keys: usedLiteralKeySet.size,
    unused_keys_count: unusedKeys.length,
    missing_keys_count: missingKeys.length,
    dynamic_calls_count: allDynamicCalls.length,
    files_scanned: sourceFiles.length,
    files_with_translations: Object.keys(usageByFile).length
  },
  languages: Object.fromEntries(
    Object.entries(dictionaryKeys).map(([lang, keys]) => [lang, keys.length])
  ),
  used_literal_keys: [...usedLiteralKeySet].sort(),
  unused_keys: unusedKeys.sort(),
  missing_keys: missingKeys.sort(),
  dynamic_calls: allDynamicCalls,
  usage_by_file: usageByFile
};

// 5. Write output
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), 'utf8');
console.log(`✅ Report written to: ${OUTPUT_FILE}\n`);

// 6. Print summary
console.log('═══════════════════════════════════════════════════');
console.log('                    SUMMARY                        ');
console.log('═══════════════════════════════════════════════════');
console.log(`  Dictionary keys (en):      ${referenceKeys.size}`);
console.log(`  Literal t() calls:         ${allLiteralKeys.length}`);
console.log(`  Unique keys used:          ${usedLiteralKeySet.size}`);
console.log(`  Unused keys:               ${unusedKeys.length}`);
console.log(`  Missing keys:              ${missingKeys.length}`);
console.log(`  Dynamic t() calls:         ${allDynamicCalls.length}`);
console.log('═══════════════════════════════════════════════════\n');

if (unusedKeys.length > 0) {
  console.log('⚠️  UNUSED KEYS (first 20):');
  unusedKeys.slice(0, 20).forEach(k => console.log(`    - ${k}`));
  if (unusedKeys.length > 20) {
    console.log(`    ... and ${unusedKeys.length - 20} more\n`);
  }
}

if (missingKeys.length > 0) {
  console.log('❌ MISSING KEYS (not in dictionary):');
  missingKeys.forEach(k => console.log(`    - ${k}`));
  console.log('');
}

if (allDynamicCalls.length > 0) {
  console.log('🔄 DYNAMIC CALLS (first 10):');
  allDynamicCalls.slice(0, 10).forEach(d => {
    console.log(`    ${d.file}:${d.line}`);
    console.log(`      Expression: ${d.expression}`);
  });
  if (allDynamicCalls.length > 10) {
    console.log(`    ... and ${allDynamicCalls.length - 10} more\n`);
  }
}

console.log('✅ Audit complete!');
