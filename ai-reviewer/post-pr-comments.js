#!/usr/bin/env node
/**
 * Posts AI review findings as PR *review comments*.
 * Reliability-first: only post when we can anchor to an exact diff line.
 * Never fall back to issue comments (avoids wrong placement / extra noise).
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
    if (!currentPath) continue;

    // For review comment API `line`, GitHub expects the line number in the *new file* (RIGHT side),
    // and it must be a line present in the diff hunk. Track newLine across added + context lines.
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const content = line.slice(1);
      const lineNum = newLine;
      newLine++;
      const methodMatch = content.match(/^\s*(public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?[\w<>\[\], ?]+\s+(\w+)\s*\(/);
      if (methodMatch) {
        const name = methodMatch[2];
        const key = `${currentPath}::${name}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({ path: currentPath, line: lineNum });
      }
      continue;
    }

    if (line.startsWith(' ')) {
      const content = line.slice(1);
      const lineNum = newLine;
      newLine++;
      const methodMatch = content.match(/^\s*(public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?[\w<>\[\], ?]+\s+(\w+)\s*\(/);
      if (methodMatch) {
        const name = methodMatch[2];
        const key = `${currentPath}::${name}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({ path: currentPath, line: lineNum });
      }
      continue;
    }

    // Deleted lines ('-') do not advance newLine.
  }
  return map;
}

/** Short comment body; include threshold for semantic-duplication. */
function formatCommentBody(f) {
  const threshold = f.thresholdUsed != null ? f.thresholdUsed : 0.88;
  if (f.type === 'semantic-duplication' && f.matchingMethod) {
    return (
      `**Semantic duplicate** (similarity ${f.similarityScore ?? '—'}, threshold **${threshold}**)\n` +
      `Duplicates logic from \`${f.matchingMethod}\`. ${(f.aiExplanation || f.description || '').slice(0, 120)}…\n\n` +
      `**Action:** Reuse \`${f.matchingMethod}\` or extract shared logic.\n` +
      `**Cursor prompt:** \`${f.cursorPrompt || 'Refactor to reuse existing logic.'}\``
    );
  }
  const title = f.title || f.type || 'Finding';
  const desc = (f.description || f.aiExplanation || '').trim();
  const action = (f.suggestedAction || '').trim();
  const cursor = (f.cursorPrompt || '').trim();

  let body = `**${title}**\n`;
  if (desc) body += `${desc}\n`;
  if (action) body += `\n**Action:** ${action}\n`;
  if (cursor) body += `**Cursor prompt:** \`${cursor}\`\n`;
  return body.trim();
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

function hunkRangesFromDiff(diffContent) {
  const map = new Map();
  if (!diffContent || typeof diffContent !== 'string') return map;

  let currentPath = null;
  for (const line of diffContent.split('\n')) {
    if (line.startsWith('+++ b/')) {
      currentPath = line.slice(6).trim();
      if (currentPath && !map.has(currentPath)) map.set(currentPath, []);
      continue;
    }
    if (!currentPath) continue;
    if (!line.startsWith('@@')) continue;

    const match = line.match(/\+(\d+)(?:,(\d+))?/);
    if (!match) continue;
    const start = Number(match[1]);
    const count = match[2] ? Number(match[2]) : 1;
    const end = start + Math.max(0, count - 1);
    map.get(currentPath).push({ start, end });
  }
  return map;
}

function lineIsInHunks(ranges, line) {
  if (!Array.isArray(ranges) || ranges.length === 0) return false;
  if (!line || typeof line !== 'number') return false;
  for (const r of ranges) {
    if (line >= r.start && line <= r.end) return true;
  }
  return false;
}

async function main() {
  findings = dedupe(findings);
  let methodLocations = new Map();
  let hunkRanges = new Map();
  if (prDiffFile && prHeadSha) {
    const diffPath = path.isAbsolute(prDiffFile) ? prDiffFile : path.resolve(process.cwd(), prDiffFile);
    if (fs.existsSync(diffPath)) {
      const diff = fs.readFileSync(diffPath, 'utf8');
      methodLocations = methodLocationsFromDiff(diff);
      hunkRanges = hunkRangesFromDiff(diff);
    }
  }

  let posted = 0;
  for (const f of findings) {
    const body = formatCommentBody(f);
    const methodName = f.method;
    const filePath = f.file || '';
    let firstLoc = null;

    // Prefer explicit (file, line) anchors from findings.
    if (filePath && typeof f.line === 'number') {
      const ranges = hunkRanges.get(filePath) || [];
      if (lineIsInHunks(ranges, f.line)) {
        firstLoc = { path: filePath, line: f.line };
      }
    }

    // Fallback: method-based anchoring.
    if (!firstLoc && methodName && filePath) {
      const locs = methodLocations.get(`${filePath}::${methodName}`);
      firstLoc = locs && locs.length > 0 ? locs[0] : null;
    }
    if (!firstLoc && methodName) {
      // Fallback: pick the first match across files.
      for (const [k, locs] of methodLocations.entries()) {
        if (k.endsWith(`::${methodName}`) && locs && locs.length > 0) {
          firstLoc = locs[0];
          break;
        }
      }
    }

    if (!prHeadSha || !firstLoc) {
      // Skip rather than risk wrong placement or noisy issue comments.
      console.log(`Skip (no reliable diff anchor): ${f.type} ${methodName || '—'}`);
      continue;
    }

    try {
      await postReviewComment(body, prHeadSha, firstLoc.path, firstLoc.line);
      console.log(`Review comment at ${firstLoc.path}:${firstLoc.line} (${f.type}: ${methodName})`);
      posted++;
    } catch (err) {
      // Reliability-first: do not fall back to other comment types.
      console.log(`Skip (review comment failed): ${f.type} ${methodName || '—'}`);
      console.log(String(err));
    }
  }
  console.log(`Posted ${posted} anchored review comment(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
