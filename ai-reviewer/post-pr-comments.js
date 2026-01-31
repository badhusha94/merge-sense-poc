#!/usr/bin/env node
/**
 * Posts AI review findings as PR comments using GitHub REST API.
 * Reads findings from FINDINGS_OUTPUT (default findings.json) and posts one comment per finding.
 * Requires: GITHUB_TOKEN, GITHUB_REPOSITORY, and either PR_NUMBER or GITHUB_REF (e.g. refs/pull/123/head).
 */

import fs from 'fs';
import path from 'path';

const findingsPath = process.env.FINDINGS_OUTPUT || 'findings.json';
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
let prNumber = process.env.PR_NUMBER;
const ref = process.env.GITHUB_REF; // refs/pull/123/merge

if (!token || !repo) {
  console.error('GITHUB_TOKEN and GITHUB_REPOSITORY are required.');
  process.exit(1);
}

if (!prNumber && ref && ref.startsWith('refs/pull/')) {
  prNumber = ref.split('/')[2];
}
if (!prNumber) {
  console.error('PR number not found. Set PR_NUMBER or run in pull_request context (GITHUB_REF).');
  process.exit(1);
}

const resolvedPath = path.isAbsolute(findingsPath) ? findingsPath : path.resolve(process.cwd(), findingsPath);
if (!fs.existsSync(resolvedPath)) {
  console.log('No findings file found. Skipping PR comments.');
  process.exit(0);
}

const findings = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
if (!Array.isArray(findings) || findings.length === 0) {
  console.log('No findings to post.');
  process.exit(0);
}

function formatCommentBody(f) {
  const title = f.type === 'semantic-duplication'
    ? '🧠 AI Review — Semantic Duplicate Detected'
    : '🧠 AI Review — Business Logic Check';
  const isDup = f.type === 'semantic-duplication' && f.matchingMethod;
  const bodyLine = isDup
    ? `This method appears to duplicate logic from \`${f.matchingMethod}\`.`
    : (f.method ? `**${f.method}** — business logic may have been altered.` : 'Business logic may have been altered.');
  const why = f.aiExplanation || f.description;
  const action = f.suggestedAction || 'Review the change.';
  const cursorPrompt = f.cursorPrompt || 'Address this finding.';

  return `${title}

${bodyLine}

**Why:**  
${why}

**Suggested Action:**  
${action}

**Cursor Prompt:**  
\`\`\`
${cursorPrompt}
\`\`\`
`;
}

const apiBase = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;

async function postComment(body) {
  const res = await fetch(apiBase, {
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
    throw new Error(`GitHub API ${res.status}: ${t}`);
  }
}

async function main() {
  for (const f of findings) {
    const body = formatCommentBody(f);
    await postComment(body);
    console.log(`Posted comment for ${f.type}: ${f.method}`);
  }
  console.log(`Posted ${findings.length} PR comment(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
