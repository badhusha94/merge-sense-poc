#!/usr/bin/env node
/**
 * AI-powered PR review: semantic duplicate detection, logic-safety check.
 * Reads .ai/review-rules.json and runs enabled core checks.
 * Outputs structured findings to a JSON file for PR comment posting.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import cosineSimilarity from 'cosine-similarity';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SIMILARITY_THRESHOLD = 0.88;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHAT_MODEL = 'gpt-4o-mini';

const prDiffFile = process.env.PR_DIFF_FILE || 'pr.diff';
const mainCodeFile = process.env.MAIN_CODE_FILE || 'main_code.cs';
const findingsOutput = process.env.FINDINGS_OUTPUT || 'findings.json';
const repoRoot = process.env.GITHUB_WORKSPACE || path.resolve(process.cwd(), '..');
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('OPENAI_API_KEY is required.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

/** Load .ai/review-rules.json; return { layers } with only non-placeholder checks. */
function loadReviewRules() {
  const p = path.join(repoRoot, '.ai', 'review-rules.json');
  if (!fs.existsSync(p)) return { layers: { core: { checks: ['semantic-duplication', 'logic-safety'] } } };
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const layers = {};
  for (const [name, config] of Object.entries(raw.layers || {})) {
    if (config.placeholder) continue;
    layers[name] = config;
  }
  return { layers, ruleDefinitions: raw.ruleDefinitions || {} };
}

/** Load prompt template from prompts/ and substitute {{KEY}} with values. */
function loadPrompt(templateName, vars = {}) {
  const p = path.join(__dirname, 'prompts', `${templateName}.txt`);
  if (!fs.existsSync(p)) return null;
  let s = fs.readFileSync(p, 'utf8');
  for (const [k, v] of Object.entries(vars)) {
    s = s.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
  }
  return s;
}

/**
 * Extract C# method bodies (signature + body) using a simple regex.
 */
function extractCSharpMethods(source) {
  const methods = [];
  const methodRegex = /(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)[^{]*\{/g;
  let match;
  while ((match = methodRegex.exec(source)) !== null) {
    const start = match.index;
    const openBrace = source.indexOf('{', start);
    let depth = 1;
    let i = openBrace + 1;
    while (i < source.length && depth > 0) {
      const c = source[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }
    const end = i;
    const methodText = source.slice(start, end).trim();
    const name = match[2];
    methods.push({ name, text: methodText });
  }
  return methods;
}

async function getEmbedding(text) {
  const { data } = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
  });
  return data[0].embedding;
}

/** Confirm same business logic and get explanation. Returns { same, explanation }. */
async function confirmSameBusinessLogicWithExplanation(methodA, methodB) {
  const prompt = loadPrompt('semantic-duplication', {
    METHOD_A: methodA,
    METHOD_B: methodB,
  }) || `Determine if these two C# methods implement the SAME business logic. Reply with two lines: first YES or NO, second a brief explanation.\n\nMethod A:\n${methodA}\n\nMethod B:\n${methodB}`;

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
  });
  const content = (completion.choices[0]?.message?.content || '').trim();
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const first = (lines[0] || '').toUpperCase();
  const same = first.startsWith('YES');
  const explanation = lines[1] || (same ? 'Methods implement the same business logic.' : 'Different logic.');
  return { same, explanation };
}

/** Check if modified method may have altered business logic. Returns { altered, explanation }. */
async function checkLogicSafety(oldMethodText, newMethodText) {
  const prompt = loadPrompt('logic-safety', {
    OLD_METHOD: oldMethodText,
    NEW_METHOD: newMethodText,
  });
  if (!prompt) throw new Error('prompts/logic-safety.txt not found');

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 100,
  });
  const content = (completion.choices[0]?.message?.content || '').trim();
  const first = (content.split('\n')[0] || '').trim().toUpperCase();
  const altered = first.startsWith('YES');
  const explanation = content.split('\n').slice(1).join(' ').trim() || (altered ? 'Business rules or calculations may have been changed.' : 'Behavior appears preserved.');
  return { altered, explanation };
}

function readFileSafe(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) return '';
  return fs.readFileSync(resolved, 'utf8');
}

function codeFromDiff(diffContent) {
  if (!diffContent.includes('\n+') && !diffContent.includes('\n-')) return diffContent;
  return diffContent
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1))
    .join('\n');
}

/** Build structured finding (schema required by spec). */
function finding(type, severity, title, description, extra = {}) {
  return {
    type,
    severity,
    title,
    description,
    file: extra.file ?? '',
    method: extra.method ?? '',
    ...extra,
  };
}

async function runSemanticDuplication(prMethods, mainMethods, findings) {
  for (const prMethod of prMethods) {
    const prEmbedding = await getEmbedding(prMethod.text);
    for (const mainMethod of mainMethods) {
      const mainEmbedding = await getEmbedding(mainMethod.text);
      const similarity = cosineSimilarity(prEmbedding, mainEmbedding);

      if (similarity >= SIMILARITY_THRESHOLD) {
        const { same, explanation } = await confirmSameBusinessLogicWithExplanation(prMethod.text, mainMethod.text);
        if (same) {
          const suggestedAction = 'Consider reusing the existing method or moving shared logic to a common service.';
          const cursorPrompt = `Refactor this method to reuse the existing logic from ${mainMethod.name} while preserving current behavior.`;
          findings.push(finding(
            'semantic-duplication',
            'high',
            'Semantic Duplicate Detected',
            explanation,
            {
              method: prMethod.name,
              matchingMethod: mainMethod.name,
              similarityScore: Math.round(similarity * 100) / 100,
              thresholdUsed: SIMILARITY_THRESHOLD,
              aiExplanation: explanation,
              suggestedAction,
              cursorPrompt,
            }
          ));
          console.log(`Finding: duplicate ${prMethod.name} <-> ${mainMethod.name} (${similarity.toFixed(2)})`);
        }
      }
    }
  }
}

async function runLogicSafety(prMethods, mainMethods, findings) {
  const byName = new Map(mainMethods.map((m) => [m.name, m]));
  for (const prMethod of prMethods) {
    const mainMethod = byName.get(prMethod.name);
    if (!mainMethod) continue;
    const { altered, explanation } = await checkLogicSafety(mainMethod.text, prMethod.text);
    if (altered) {
      const suggestedAction = 'Review the change to ensure business rules, conditions, and calculations are preserved.';
      const cursorPrompt = `Review this method change: restore or align business logic with the original behavior (conditions, calculations, validations).`;
      findings.push(finding(
        'logic-safety',
        'high',
        'Business Logic May Have Changed',
        explanation,
        {
          method: prMethod.name,
          aiExplanation: explanation,
          suggestedAction,
          cursorPrompt,
        }
      ));
      console.log(`Finding: logic-safety ${prMethod.name}`);
    }
  }
}

async function main() {
  const rules = loadReviewRules();
  const coreChecks = rules.layers.core?.checks || ['semantic-duplication', 'logic-safety'];

  const prDiffRaw = readFileSafe(prDiffFile);
  const mainCode = readFileSafe(mainCodeFile);
  const prCode = codeFromDiff(prDiffRaw) || mainCode;
  const prMethods = extractCSharpMethods(prCode);
  const mainMethods = extractCSharpMethods(mainCode);

  if (prMethods.length === 0) {
    console.log('No C# methods found in PR diff / code. Skipping AI review.');
    const outPath = path.isAbsolute(findingsOutput) ? findingsOutput : path.resolve(process.cwd(), findingsOutput);
    fs.writeFileSync(outPath, JSON.stringify([], null, 2));
    return;
  }

  console.log(`PR methods: ${prMethods.length}, Main methods: ${mainMethods.length}. Running: ${coreChecks.join(', ')}`);
  const findings = [];

  if (coreChecks.includes('semantic-duplication')) {
    await runSemanticDuplication(prMethods, mainMethods, findings);
  }
  if (coreChecks.includes('logic-safety')) {
    await runLogicSafety(prMethods, mainMethods, findings);
  }

  const outPath = path.isAbsolute(findingsOutput) ? findingsOutput : path.resolve(process.cwd(), findingsOutput);
  fs.writeFileSync(outPath, JSON.stringify(findings, null, 2));
  console.log(`Wrote ${findings.length} finding(s) to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
