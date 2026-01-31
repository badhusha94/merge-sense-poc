#!/usr/bin/env node
/**
 * Applies AI-suggested refactors from findings: reads findings + diff, gets file path per method,
 * calls OpenAI to refactor each file, writes changes, commits, pushes, then posts a comment
 * asking the developer to test before merge. Run only after human approval (e.g. environment).
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import OpenAI from 'openai';

const CHAT_MODEL = 'gpt-4o-mini';

const repoRoot = process.env.GITHUB_WORKSPACE || path.resolve(process.cwd(), '..');
const findingsPath = process.env.FINDINGS_OUTPUT || path.join(repoRoot, 'findings.json');
const prDiffFile = process.env.PR_DIFF_FILE || path.join(repoRoot, 'pr.diff');
const prHeadRef = process.env.PR_HEAD_REF;
const prNumber = process.env.PR_NUMBER;
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey || !token || !repo) {
  console.error('OPENAI_API_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY, and PR_HEAD_REF are required.');
  process.exit(1);
}

if (!prHeadRef) {
  console.error('PR_HEAD_REF (branch name to push to) is required.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

/** Parse diff to get method name -> first { path } for that method. */
function methodPathFromDiff(diffContent) {
  const map = new Map();
  if (!diffContent || typeof diffContent !== 'string') return map;
  let currentPath = null;
  const lines = diffContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      currentPath = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++') && currentPath) {
      const content = line.slice(1);
      const methodMatch = content.match(/\b(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?\w+\s+(\w+)\s*\(/);
      if (methodMatch) {
        const name = methodMatch[1];
        if (!map.has(name)) map.set(name, currentPath);
      }
    }
  }
  return map;
}

/** Ask AI to refactor the file for this finding; return full file content. */
async function refactorFile(filePath, fileContent, finding) {
  const prompt = `You are a refactoring assistant. Apply exactly one change to this C# file.

Refactor instruction: ${finding.cursorPrompt || 'Address the finding.'}

Rules:
- Return ONLY the complete file content after the change. No explanation, no markdown, no code block wrapper.
- Preserve formatting and style. Change only what is needed for the refactor.
- Do not add or remove using statements unless required by the change.

File path: ${filePath}

Current file content:
\`\`\`
${fileContent}
\`\`\`

Return only the new file content:`;

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4096,
  });
  let out = (completion.choices[0]?.message?.content || '').trim();
  if (out.startsWith('```')) {
    out = out.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
  }
  return out;
}

/** Post a PR comment (e.g. "Refactor applied. Please test before merge."). */
async function postComment(body) {
  if (!prNumber || !token || !repo) return;
  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`Comment API ${res.status}: ${await res.text()}`);
}

async function main() {
  const findingsResolved = path.isAbsolute(findingsPath) ? findingsPath : path.resolve(process.cwd(), findingsPath);
  if (!fs.existsSync(findingsResolved)) {
    console.log('No findings file. Nothing to apply.');
    return;
  }

  let findings = JSON.parse(fs.readFileSync(findingsResolved, 'utf8'));
  if (!Array.isArray(findings) || findings.length === 0) {
    console.log('No findings to apply.');
    return;
  }

  const diffPath = path.isAbsolute(prDiffFile) ? prDiffFile : path.resolve(process.cwd(), prDiffFile);
  const diffContent = fs.existsSync(diffPath) ? fs.readFileSync(diffPath, 'utf8') : '';
  const methodToPath = methodPathFromDiff(diffContent);

  const dedupe = new Set();
  findings = findings.filter((f) => {
    const key = `${f.type}|${f.method || ''}|${f.matchingMethod || ''}`;
    if (dedupe.has(key)) return false;
    dedupe.add(key);
    return true;
  });

  const repoRootResolved = path.isAbsolute(repoRoot) ? repoRoot : path.resolve(process.cwd(), repoRoot);
  let applied = 0;

  for (const f of findings) {
    const filePath = f.method ? methodToPath.get(f.method) : null;
    if (!filePath) {
      console.log(`Skipping ${f.method}: no file path from diff.`);
      continue;
    }
    const fullPath = path.join(repoRootResolved, filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`Skipping ${filePath}: file not found.`);
      continue;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    const newContent = await refactorFile(filePath, content, f);
    if (newContent && newContent !== content) {
      fs.writeFileSync(fullPath, newContent);
      applied++;
      console.log(`Applied refactor to ${filePath} (${f.method}).`);
    }
  }

  if (applied === 0) {
    console.log('No files changed.');
    return;
  }

  execSync('git config user.name "github-actions[bot]"', { cwd: repoRootResolved });
  execSync('git config user.email "github-actions[bot]@users.noreply.github.com"', { cwd: repoRootResolved });
  execSync('git add -A', { cwd: repoRootResolved });
  execSync(`git commit -m "chore: AI refactor (${applied} finding(s))"`, { cwd: repoRootResolved });
  execSync(`git push origin HEAD:${prHeadRef}`, { cwd: repoRootResolved, env: { ...process.env, GIT_ASKPASS: '', GIT_TERMINAL_PROMPT: '0' } });

  const sha = execSync('git rev-parse HEAD', { cwd: repoRootResolved, encoding: 'utf8' }).trim();
  const comment =
    `✅ **AI refactor applied** (commit \`${sha.slice(0, 7)}\`, ${applied} change(s)).\n\n` +
    `Checks will re-run on this PR. **Please test locally and run your tests before merging.**`;
  await postComment(comment);
  console.log('Pushed and posted comment.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
