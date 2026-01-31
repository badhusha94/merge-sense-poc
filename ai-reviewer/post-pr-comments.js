#!/usr/bin/env node
/**
 * Posts AI review findings as PR comments. Uses Review Comments API (at line) when
 * file/line can be resolved from the diff; otherwise falls back to issue comment.
 * Deduplicates by (type, method, matchingMethod). Short comments only.
 */

import fs from 'fs';
import path from 'path';

const findingsPath = process.env.FINDINGS_OUTPUT || 'findings.json';
const prDiffFile = process.env.PR_DIFF_FILE;
const prHeadSha = process.env.PR_HEAD_SHA;
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
let prNumber = process.env.PR_NUMBER;
const ref = process.env.GITHUB_REF;

if (!token || !repo) {
  console.error('GITHUB_TOKEN and GITHUB_REPOSITORY are required.');
  process.exit(1);
}

if (!prNumber && ref && ref.startsWith('refs/pull/')) {
  prNumber = ref.split('/')[2];
}
if (!prNumber) {
  console.error('PR number not found. Set PR_NUMBER or run in pull_request context.');
  process.exit(1);
}

const resolvedPath = path.isAbsolute(findingsPath) ? findingsPath : path.resolve(process.cwd(), findingsPath);
if (!fs.existsSync(resolvedPath)) {
  console.log('No findings file. Skipping PR comments.');
  process.exit(0);
}

let findings = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
if (!Array.isArray(findings) || findings.length === 0) {
  console.log('No findings to post.');
  process.exit(0);
}

/** Deduplicate: keep one per (type, method, matchingMethod). */
function dedupe(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    const key = `${f.type}|${f.method || ''}|${f.matchingMethod || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Parse diff to build method name -> [{ path, line }]. Only added lines; line is in new file. */
function methodLocationsFromDiff(diffContent) {
  const map = new Map();
  if (!diffContent || typeof diffContent !== 'string') return map;
  let currentPath = null;
  let newLine = 0;
  const lines = diffContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('+++ b/')) {
      currentPath = line.slice(6).trim();
      newLine = 0;
      continue;
    }
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)(?:,\d+)?/);
      if (match) newLine = parseInt(match[1], 10);
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++') && currentPath) {
      const lineNum = newLine;
      newLine++;
      const content = line.slice(1);
      const methodMatch = content.match(/\b(public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?\w+\s+(\w+)\s*\(/);
      if (methodMatch) {
        const name = methodMatch[2];
        if (!map.has(name)) map.set(name, []);
        map.get(name).push({ path: currentPath, line: lineNum });
      }
    }
  }
  return map;
}

/** Short comment body; include threshold for semantic-duplication. */
function formatCommentBody(f) {
  const threshold = f.thresholdUsed != null ? f.thresholdUsed : 0.88;
  if (f.type === 'semantic-duplication' && f.matchingMethod) {
    return (
      `🧠 **Semantic duplicate** (similarity ${f.similarityScore ?? '—'}, threshold **${threshold}**)\n` +
      `Duplicates logic from \`${f.matchingMethod}\`. ${(f.aiExplanation || f.description || '').slice(0, 120)}…\n\n` +
      `**Action:** Reuse \`${f.matchingMethod}\` or extract shared logic.\n` +
      `**Cursor:** \`${f.cursorPrompt || 'Refactor to reuse existing logic.'}\`\n\n` +
      `_Comment \`/ai-apply-refactor\` on this PR to have the AI apply fixes (requires your approval)._`
    );
  }
  if (f.type === 'logic-safety') {
    return (
      `🧠 **Logic safety** — ${(f.aiExplanation || f.description || '').slice(0, 120)}…\n\n` +
      `**Action:** Restore or align business rules/conditions/calculations.\n` +
      `**Cursor:** \`${f.cursorPrompt || 'Restore original business logic.'}\`\n\n` +
      `_Comment \`/ai-apply-refactor\` on this PR to have the AI apply fixes (requires your approval)._`
    );
  }
  return `🧠 **${f.title || f.type}** — ${(f.description || '').slice(0, 150)}`;
}

const apiBase = `https://api.github.com/repos/${repo}`;

async function postReviewComment(body, commitId, path, line) {
  const res = await fetch(`${apiBase}/pulls/${prNumber}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      body,
      commit_id: commitId,
      path,
      line,
      side: 'RIGHT',
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Review comment API ${res.status}: ${t}`);
  }
}

async function postIssueComment(body) {
  const res = await fetch(`${apiBase}/issues/${prNumber}/comments`, {
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
    const t = await res.text();
    throw new Error(`Issue comment API ${res.status}: ${t}`);
  }
}

async function main() {
  findings = dedupe(findings);
  let methodLocations = new Map();
  if (prDiffFile && prHeadSha) {
    const diffPath = path.isAbsolute(prDiffFile) ? prDiffFile : path.resolve(process.cwd(), prDiffFile);
    if (fs.existsSync(diffPath)) {
      methodLocations = methodLocationsFromDiff(fs.readFileSync(diffPath, 'utf8'));
    }
  }

  let posted = 0;
  for (const f of findings) {
    const body = formatCommentBody(f);
    const methodName = f.method;
    const locs = methodName ? methodLocations.get(methodName) : null;
    const firstLoc = locs && locs.length > 0 ? locs[0] : null;

    if (prHeadSha && firstLoc) {
      await postReviewComment(body, prHeadSha, firstLoc.path, firstLoc.line);
      console.log(`Review comment at ${firstLoc.path}:${firstLoc.line} (${f.type}: ${methodName})`);
    } else {
      await postIssueComment(body);
      console.log(`Issue comment (${f.type}: ${methodName || '—'})`);
    }
    posted++;
  }
  const summary = `_To have the AI apply these fixes (with your approval), comment \`/ai-apply-refactor\` on this PR. A human must approve before code is changed._`;
  await postIssueComment(summary);
  console.log(`Posted ${posted} comment(s) + refactor option.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
