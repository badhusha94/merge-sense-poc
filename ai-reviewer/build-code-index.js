#!/usr/bin/env node
/**
 * Builds .ai/code-index.json: scans C# files (e.g. from main branch), extracts methods,
 * generates short AI summaries, and stores them. Used to reduce repeated analysis cost
 * and improve semantic understanding in PR review.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHAT_MODEL = 'gpt-4o-mini';
const repoRoot = process.env.GITHUB_WORKSPACE || path.resolve(process.cwd(), '..');
const codeIndexPath = path.join(repoRoot, '.ai', 'code-index.json');
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('OPENAI_API_KEY is required.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

function extractCSharpMethods(source, filePath = '') {
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
    methods.push({ file: filePath, name, text: methodText });
  }
  return methods;
}

async function summarizeMethod(methodText) {
  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [{
      role: 'user',
      content: `Summarize this C# method in one short sentence (business purpose, key logic). No code.\n\n${methodText.slice(0, 4000)}`,
    }],
    max_tokens: 80,
  });
  return (completion.choices[0]?.message?.content || '').trim();
}

async function main() {
  const inputFile = process.env.MAIN_CODE_FILE || path.join(repoRoot, 'main_code.cs');
  const inputPath = path.isAbsolute(inputFile) ? inputFile : path.resolve(process.cwd(), inputFile);
  if (!fs.existsSync(inputPath)) {
    console.log('No main code file found. Run with MAIN_CODE_FILE set (e.g. after extracting main branch C#).');
    fs.mkdirSync(path.dirname(codeIndexPath), { recursive: true });
    fs.writeFileSync(codeIndexPath, '[]');
    return;
  }

  const source = fs.readFileSync(inputPath, 'utf8');
  const methods = extractCSharpMethods(source, path.basename(inputPath));
  const index = [];

  for (const m of methods) {
    const summary = await summarizeMethod(m.text);
    index.push({
      file: m.file,
      method: m.name,
      summary,
    });
  }

  fs.mkdirSync(path.dirname(codeIndexPath), { recursive: true });
  fs.writeFileSync(codeIndexPath, JSON.stringify(index, null, 2));
  console.log(`Wrote ${index.length} entries to ${codeIndexPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
