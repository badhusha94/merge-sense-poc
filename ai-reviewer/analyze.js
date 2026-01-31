#!/usr/bin/env node
/**
 * Semantic duplicate detection during PR review.
 * Uses text-embedding-3-small and cosine similarity; gpt-4o-mini for confirmation.
 */

import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import cosineSimilarity from 'cosine-similarity';

const SIMILARITY_THRESHOLD = 0.88;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHAT_MODEL = 'gpt-4o-mini';

const prDiffFile = process.env.PR_DIFF_FILE || 'pr.diff';
const mainCodeFile = process.env.MAIN_CODE_FILE || 'main_code.cs';
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('OPENAI_API_KEY is required.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

/**
 * Extract C# method bodies (signature + body) using a simple regex.
 * Matches method blocks with balanced braces.
 */
function extractCSharpMethods(source) {
  const methods = [];
  // Match: optional modifiers, return type, method name, (params), then { ... }
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

/**
 * Get embedding for a string using text-embedding-3-small.
 */
async function getEmbedding(text) {
  const { data } = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // model limit
  });
  return data[0].embedding;
}

/**
 * Ask GPT to confirm if two methods implement the same business logic.
 */
async function confirmSameBusinessLogic(methodA, methodB) {
  const prompt = `You are a code reviewer. Two C# method snippets are shown below.
Determine if they implement the SAME business logic (same rules, same edge cases, same numerical behavior).
Ignore naming and style. Focus on: age thresholds, percentages, formulas, conditions.

Method A:
\`\`\`csharp
${methodA}
\`\`\`

Method B:
\`\`\`csharp
${methodB}
\`\`\`

Answer with exactly one line: YES if same business logic, NO if different (e.g. different age threshold or formula).`;

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 50,
  });
  const content = (completion.choices[0]?.message?.content || '').trim().toUpperCase();
  return content.startsWith('YES');
}

/**
 * Read file content; return empty string if missing.
 */
function readFileSafe(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) return '';
  return fs.readFileSync(resolved, 'utf8');
}

/**
 * If content is a diff (patch), extract added lines to get PR-side code.
 */
function codeFromDiff(diffContent) {
  if (!diffContent.includes('\n+') && !diffContent.includes('\n-')) return diffContent;
  return diffContent
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1))
    .join('\n');
}

async function main() {
  const prDiffRaw = readFileSafe(prDiffFile);
  const mainCode = readFileSafe(mainCodeFile);

  const prCode = codeFromDiff(prDiffRaw) || mainCode;
  const prMethods = extractCSharpMethods(prCode);
  const mainMethods = extractCSharpMethods(mainCode);

  if (prMethods.length === 0) {
    console.log('No C# methods found in PR diff / code. Skipping semantic check.');
    return;
  }

  console.log(`PR methods: ${prMethods.length}, Main methods: ${mainMethods.length}`);
  console.log('---');

  for (const prMethod of prMethods) {
    const prEmbedding = await getEmbedding(prMethod.text);
    for (const mainMethod of mainMethods) {
      const mainEmbedding = await getEmbedding(mainMethod.text);
      const similarity = cosineSimilarity(prEmbedding, mainEmbedding);

      if (similarity >= SIMILARITY_THRESHOLD) {
        const confirmed = await confirmSameBusinessLogic(prMethod.text, mainMethod.text);
        console.log(`Similarity: ${similarity.toFixed(4)} | PR: ${prMethod.name} <-> Main: ${mainMethod.name}`);
        console.log(`  GPT confirmation (same business logic): ${confirmed ? 'YES' : 'NO'}`);
        console.log('---');
      }
    }
  }

  console.log('Semantic duplicate check finished.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
