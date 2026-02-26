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
const ALLOWED_PREFIX = 'modern-app/api/';

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

function normalizeRepoPath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.?\//, '');
}

function isAllowedTargetPath(p) {
  const s = normalizeRepoPath(p);
  return s.startsWith(ALLOWED_PREFIX) && !s.includes('/bin/') && !s.includes('/obj/');
}

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

function findingKey(f) {
  const type = String(f?.type || '');
  const title = String(f?.title || '');
  const file = normalizeRepoPath(f?.file || '');
  const line = typeof f?.line === 'number' ? String(f.line) : '';
  const method = String(f?.method || '');
  const matching = String(f?.matchingMethod || '');
  return `${type}|${title}|${file}|${line}|${method}|${matching}`;
}

const FINDING_MARKER_PREFIX = '<!-- ai-finding-key:';

async function listReviewComments() {
  if (!prNumber || !token || !repo) return [];
  const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/comments?per_page=100`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`Warning: list review comments failed (${res.status}). ${text}`);
    return [];
  }
  return await res.json();
}

async function updateReviewComment(commentId, body) {
  const res = await fetch(`https://api.github.com/repos/${repo}/pulls/comments/${commentId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`Warning: update review comment failed (${res.status}). ${text}`);
  }
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
  if (!res.ok) {
    const text = await res.text();
    // Common in locked-down org settings or integration-restricted tokens.
    // Refactors were already pushed; don't fail the whole workflow just because commenting is forbidden.
    console.warn(`Warning: PR comment failed (${res.status}). Continuing. Response: ${text}`);
    return;
  }
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
  const appliedFindingKeys = new Set();

  for (const f of findings) {
    const filePath = f.file ? normalizeRepoPath(f.file) : (f.method ? methodToPath.get(f.method) : null);
    if (!filePath) {
      console.log(`Skipping ${f.method}: no file path from diff.`);
      continue;
    }
    if (!isAllowedTargetPath(filePath)) {
      console.log(`Skipping ${filePath}: not an allowed target path.`);
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
      appliedFindingKeys.add(findingKey(f));
      console.log(`Applied refactor to ${filePath} (${f.method}).`);
    }
  }

  if (applied === 0) {
    console.log('No files changed.');
    return;
  }

  execSync('git config user.name "github-actions[bot]"', { cwd: repoRootResolved });
  execSync('git config user.email "github-actions[bot]@users.noreply.github.com"', { cwd: repoRootResolved });
  // Only stage Modern API changes; never commit tooling/workflows/scripts.
  execSync('git add modern-app/api', { cwd: repoRootResolved });
  execSync(`git commit -m "chore: AI refactor (${applied} finding(s))"`, { cwd: repoRootResolved });
  execSync(`git push origin HEAD:${prHeadRef}`, { cwd: repoRootResolved, env: { ...process.env, GIT_ASKPASS: '', GIT_TERMINAL_PROMPT: '0' } });

  const sha = execSync('git rev-parse HEAD', { cwd: repoRootResolved, encoding: 'utf8' }).trim();

  // Mark bot review comments as resolved for findings we actually applied.
  try {
    const comments = await listReviewComments();
    const resolvedStamp = `✅ Resolved by AI refactor in commit \`${sha.slice(0, 7)}\`.`;
    for (const c of Array.isArray(comments) ? comments : []) {
      const body = String(c?.body || '');
      if (!body.includes(FINDING_MARKER_PREFIX)) continue;
      const match = body.match(/<!-- ai-finding-key:\s*([^>]+)\s*-->/);
      const key = match ? match[1].trim() : '';
      if (!key) continue;
      if (!appliedFindingKeys.has(key)) continue;
      if (body.includes(resolvedStamp)) continue;
      await updateReviewComment(c.id, `${body}\n\n${resolvedStamp}`);
    }
  } catch (e) {
    console.warn(`Warning: failed to mark comments resolved. Continuing. ${e?.message || e}`);
  }

  const comment =
    `✅ **AI refactor applied** (commit \`${sha.slice(0, 7)}\`, ${applied} change(s)).\n\n` +
    `Checks will re-run on this PR. **Please test locally and run your tests before merging.**`;
  try {
    await postComment(comment);
  } catch (e) {
    console.warn(`Warning: failed to post PR comment. Continuing. ${e?.message || e}`);
  }
  console.log('Pushed and posted comment.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
