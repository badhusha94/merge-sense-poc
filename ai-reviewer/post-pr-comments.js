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
const APPLY_REFACTOR_HINT_MARKER = '<!-- ai-apply-refactor-hint -->';
const SUMMARY_MARKER = '<!-- ai-review-summary -->';
const FINDING_MARKER_PREFIX = '<!-- ai-finding-key:';

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
    // Reliability: project-rule findings often have no method name, so dedupe on full finding identity.
    const key = findingKey(f);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeRepoPath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.?\//, '');
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

function markerForFinding(f) {
  return `${FINDING_MARKER_PREFIX} ${findingKey(f)} -->`;
}

async function listReviewComments() {
  const res = await fetch(`${apiBase}/pulls/${prNumber}/comments?per_page=100`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Review comments API ${res.status}: ${t}`);
  }
  return await res.json();
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
  const similarityPct = typeof f.similarityPercent === 'number'
    ? f.similarityPercent
    : (typeof f.similarityScore === 'number' ? Math.round(f.similarityScore * 100) : null);
  const thresholdPct = typeof f.thresholdPercent === 'number'
    ? f.thresholdPercent
    : (f.thresholdUsed != null ? Math.round(Number(f.thresholdUsed) * 100) : null);

  if (f.type === 'semantic-duplication' && f.matchingMethod) {
    const matchLoc = f.matchingFile
      ? ` (${f.matchingFile}${typeof f.matchingLine === 'number' && f.matchingLine > 0 ? `:${f.matchingLine}` : ''})`
      : '';
    return (
      `**Semantic duplicate** (similarity ${similarityPct != null ? `${similarityPct}%` : '—'}, threshold **${thresholdPct != null ? `${thresholdPct}%` : '—'}**)\n` +
      `Duplicates logic from \`${f.matchingMethod}\`${matchLoc}. ${(f.aiExplanation || f.description || '').slice(0, 120)}…\n\n` +
      `**Action:** Reuse \`${f.matchingMethod}\` or extract shared logic.\n` +
      `**Cursor prompt:** \`${f.cursorPrompt || 'Refactor to reuse existing logic.'}\``
    );
  }

  if (f.type === 'csharp-learning') {
    const title = f.title || 'C# tip';
    const desc = (f.aiExplanation || f.description || '').trim();
    const replacement = String(f.replacementCode || '').trim();
    const direct = Boolean(f.directReplacement) && replacement.length > 0;

    let body = `**${title}**\n`;
    if (desc) body += `${desc}\n`;

    if (direct) {
      const lines = replacement.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        body += `\n**Replace with:** \`${replacement}\`\n`;
      } else {
        body += `\n**Replace with:**\n\`\`\`csharp\n${replacement}\n\`\`\`\n`;
      }
      // Intentionally omit cursor prompt for direct replacements.
      return body.trim();
    }

    const action = (f.suggestedAction || '').trim();
    const cursor = (f.cursorPrompt || '').trim();
    if (action) body += `\n**Action:** ${action}\n`;
    if (cursor) body += `**Cursor prompt:** \`${cursor}\`\n`;
    return body.trim();
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

async function listIssueComments() {
  const res = await fetch(`${apiBase}/issues/${prNumber}/comments?per_page=100`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Issue comments API ${res.status}: ${t}`);
  }
  return await res.json();
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

/** Build a single copy-paste Cursor Agent prompt that fixes all findings step-by-step. */
function buildCursorPrompt(findings) {
  const groups = {
    semantic: [],
    constant: [],
    dtoShape: [],
    projectRule: [],
    csharpLearning: [],
    logicSafety: [],
    other: [],
  };

  for (const f of findings) {
    const t = f.type || '';
    if (t === 'semantic-duplication') groups.semantic.push(f);
    else if (t === 'constant-duplication') groups.constant.push(f);
    else if (t === 'dto-shape-duplication') groups.dtoShape.push(f);
    else if (t === 'project-rule') groups.projectRule.push(f);
    else if (t === 'csharp-learning') groups.csharpLearning.push(f);
    else if (t === 'logic-safety') groups.logicSafety.push(f);
    else groups.other.push(f);
  }

  let prompt = '';
  prompt += 'Fix the following AI code review findings in this repository.\n';
  prompt += 'Work through each step sequentially. After each step, verify the file compiles before moving on.\n\n';

  let step = 1;

  // --- Semantic Duplications (most critical) ---
  if (groups.semantic.length > 0) {
    prompt += `## Step ${step}: Resolve Semantic Duplications\n\n`;
    prompt += 'These methods duplicate business logic that already exists. ';
    prompt += 'Extract shared logic into a common service or reuse the existing method.\n\n';

    const seen = new Set();
    for (const f of groups.semantic) {
      const key = `${f.method}|${f.matchingMethod}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const loc = f.file && f.line ? `${f.file}:${f.line}` : f.file || '(unknown)';
      const matchLoc = f.matchingFile && f.matchingLine ? `${f.matchingFile}:${f.matchingLine}` : f.matchingFile || '';

      prompt += `### ${step}.${seen.size} \`${f.method}\` duplicates \`${f.matchingMethod}\`\n`;
      prompt += `- **New method:** \`${loc}\`\n`;
      if (matchLoc) prompt += `- **Existing method:** \`${matchLoc}\`\n`;
      if (f.aiExplanation) prompt += `- **Why:** ${f.aiExplanation.slice(0, 200)}\n`;
      prompt += `- **Fix:** Read both methods. Extract the shared calculation into a new static helper (e.g. \`SharedCalculations.ComputeAdjustedAmount\`) in a common file. `;
      prompt += `Update both \`${f.method}\` and \`${f.matchingMethod}\` to call the shared helper.\n`;
      prompt += `- **Constraint:** Preserve exact numerical behavior — same thresholds, same edge cases, same formula.\n\n`;
    }

    // Few-shot example for semantic duplication
    prompt += '<details><summary>Example: how to fix a semantic duplicate</summary>\n\n';
    prompt += '**Before (duplicate in two files):**\n';
    prompt += '```csharp\n';
    prompt += '// Services/CreditNoteService.cs:130\n';
    prompt += 'public decimal CalculateCreditAmount(decimal invoiceAmount, decimal returnPercent, int loyaltyYears)\n';
    prompt += '{\n';
    prompt += '    if (invoiceAmount <= 0) return 0m;\n';
    prompt += '    var rate = returnPercent > 0.50m ? 0.50m : returnPercent;\n';
    prompt += '    var baseAmount = invoiceAmount * rate;\n';
    prompt += '    baseAmount -= baseAmount * 0.05m; // tax\n';
    prompt += '    if (loyaltyYears > 5) baseAmount += baseAmount * 0.10m; // loyalty bonus\n';
    prompt += '    return baseAmount;\n';
    prompt += '}\n';
    prompt += '\n';
    prompt += '// Services/DebitNoteManager.cs:104\n';
    prompt += 'public decimal ComputeDebitValue(decimal invoiceAmount, decimal adjustmentRate, int tenureYears)\n';
    prompt += '{\n';
    prompt += '    if (invoiceAmount <= 0m) return 0m;\n';
    prompt += '    var rate = adjustmentRate > 0.50m ? 0.50m : adjustmentRate;\n';
    prompt += '    var baseDebit = invoiceAmount * rate;\n';
    prompt += '    var afterTax = baseDebit - (baseDebit * 0.05m);\n';
    prompt += '    if (tenureYears > 5) afterTax += afterTax * 0.10m;\n';
    prompt += '    return afterTax;\n';
    prompt += '}\n';
    prompt += '```\n\n';
    prompt += '**After (shared helper):**\n';
    prompt += '```csharp\n';
    prompt += '// Services/SharedCalculations.cs (new file)\n';
    prompt += 'public static class SharedCalculations\n';
    prompt += '{\n';
    prompt += '    public const decimal TAX_RATE = 0.05m;\n';
    prompt += '    public const decimal LOYALTY_BONUS_RATE = 0.10m;\n';
    prompt += '    public const int LOYALTY_THRESHOLD_YEARS = 5;\n';
    prompt += '    public const decimal MAX_ADJUSTMENT_RATE = 0.50m;\n';
    prompt += '\n';
    prompt += '    public static decimal ComputeAdjustedAmount(decimal invoiceAmount, decimal rate, int tenureYears)\n';
    prompt += '    {\n';
    prompt += '        if (invoiceAmount <= 0m) return 0m;\n';
    prompt += '        var effectiveRate = rate > MAX_ADJUSTMENT_RATE ? MAX_ADJUSTMENT_RATE : rate;\n';
    prompt += '        var baseAmount = invoiceAmount * effectiveRate;\n';
    prompt += '        baseAmount -= baseAmount * TAX_RATE;\n';
    prompt += '        if (tenureYears > LOYALTY_THRESHOLD_YEARS)\n';
    prompt += '            baseAmount += baseAmount * LOYALTY_BONUS_RATE;\n';
    prompt += '        return baseAmount;\n';
    prompt += '    }\n';
    prompt += '}\n';
    prompt += '\n';
    prompt += '// Then in CreditNoteService.cs:\n';
    prompt += 'public decimal CalculateCreditAmount(decimal invoiceAmount, decimal returnPercent, int loyaltyYears)\n';
    prompt += '    => SharedCalculations.ComputeAdjustedAmount(invoiceAmount, returnPercent, loyaltyYears);\n';
    prompt += '\n';
    prompt += '// Then in DebitNoteManager.cs:\n';
    prompt += 'public decimal ComputeDebitValue(decimal invoiceAmount, decimal adjustmentRate, int tenureYears)\n';
    prompt += '    => SharedCalculations.ComputeAdjustedAmount(invoiceAmount, adjustmentRate, tenureYears);\n';
    prompt += '```\n\n';
    prompt += '</details>\n\n';

    step++;
  }

  // --- Constant Duplications ---
  if (groups.constant.length > 0) {
    prompt += `## Step ${step}: Consolidate Duplicate Constants\n\n`;
    prompt += 'These constants duplicate values already defined elsewhere. Move them to a shared location.\n\n';

    for (let i = 0; i < groups.constant.length; i++) {
      const f = groups.constant[i];
      const loc = f.file && f.line ? `${f.file}:${f.line}` : f.file || '';
      const matchLoc = f.matchingFile && f.matchingLine ? `${f.matchingFile}:${f.matchingLine}` : f.matchingFile || '';
      prompt += `${step}.${i + 1} **\`${f.method || f.description?.match(/`(\w+)`/)?.[1] || 'constant'}\`** at \`${loc}\``;
      if (f.matchingConstant && matchLoc) prompt += ` — duplicates \`${f.matchingConstant}\` at \`${matchLoc}\``;
      prompt += '\n';
    }
    prompt += `\n**Fix:** Remove the duplicate constants. Import and reuse from the existing location, or centralize all shared constants into \`SharedCalculations.cs\`.\n\n`;
    step++;
  }

  // --- DTO Shape Duplications ---
  if (groups.dtoShape.length > 0) {
    prompt += `## Step ${step}: Consolidate Duplicate DTOs\n\n`;
    for (let i = 0; i < groups.dtoShape.length; i++) {
      const f = groups.dtoShape[i];
      const loc = f.file && f.line ? `${f.file}:${f.line}` : f.file || '';
      prompt += `${step}.${i + 1} **\`${f.method || 'DTO'}\`** at \`${loc}\``;
      if (f.matchingType) prompt += ` — same shape as \`${f.matchingType}\``;
      prompt += '\n';
    }
    prompt += `\n**Fix:** Reuse the existing DTO type or create a shared base record. Map at service boundaries if field names differ.\n\n`;
    step++;
  }

  // --- Project Rule Violations ---
  if (groups.projectRule.length > 0) {
    prompt += `## Step ${step}: Fix Project Rule Violations\n\n`;
    for (let i = 0; i < groups.projectRule.length; i++) {
      const f = groups.projectRule[i];
      const loc = f.file && f.line ? `${f.file}:${f.line}` : f.file || '';
      prompt += `${step}.${i + 1} \`${loc}\` — ${f.title || f.description || 'project rule violation'}\n`;
      if (f.suggestedAction) prompt += `   Fix: ${f.suggestedAction}\n`;
    }
    prompt += '\n';
    step++;
  }

  // --- C# Learning Tips ---
  if (groups.csharpLearning.length > 0) {
    prompt += `## Step ${step}: Apply Modern C# Improvements\n\n`;
    for (let i = 0; i < groups.csharpLearning.length; i++) {
      const f = groups.csharpLearning[i];
      const loc = f.file && f.line ? `${f.file}:${f.line}` : f.file || '';
      prompt += `${step}.${i + 1} \`${loc}\` — ${f.title || 'C# improvement'}\n`;
      if (f.replacementCode) prompt += `   Replace with: \`${f.replacementCode.split('\n')[0]}\`\n`;
      else if (f.suggestedAction) prompt += `   Fix: ${f.suggestedAction}\n`;
    }
    prompt += '\n';
    step++;
  }

  // --- Logic Safety ---
  if (groups.logicSafety.length > 0) {
    prompt += `## Step ${step}: Review Logic Safety Warnings\n\n`;
    prompt += 'These methods may have altered business logic compared to the original. Verify the behavior is intentional.\n\n';
    for (let i = 0; i < groups.logicSafety.length; i++) {
      const f = groups.logicSafety[i];
      const loc = f.file && f.line ? `${f.file}:${f.line}` : f.file || '';
      prompt += `${step}.${i + 1} \`${f.method || 'method'}\` at \`${loc}\` — ${(f.aiExplanation || f.description || '').slice(0, 150)}\n`;
    }
    prompt += '\n';
    step++;
  }

  // --- Other ---
  if (groups.other.length > 0) {
    prompt += `## Step ${step}: Other Findings\n\n`;
    for (let i = 0; i < groups.other.length; i++) {
      const f = groups.other[i];
      const loc = f.file && f.line ? `${f.file}:${f.line}` : f.file || '';
      prompt += `${step}.${i + 1} \`${loc}\` — ${f.title || f.type || 'finding'}: ${(f.description || '').slice(0, 150)}\n`;
      if (f.suggestedAction) prompt += `   Fix: ${f.suggestedAction}\n`;
    }
    prompt += '\n';
    step++;
  }

  prompt += '## Final Step: Verify\n\n';
  prompt += 'After all fixes, run `dotnet build` in the `modern-app/api/ModernApi` directory and confirm zero errors and zero warnings.\n';

  return prompt;
}

/** Build the full PR summary comment with finding overview + copyable Cursor prompt. */
function buildSummaryComment(findings) {
  const semCount = findings.filter((f) => f.type === 'semantic-duplication').length;
  const constCount = findings.filter((f) => f.type === 'constant-duplication').length;
  const dtoCount = findings.filter((f) => f.type === 'dto-shape-duplication').length;
  const ruleCount = findings.filter((f) => f.type === 'project-rule').length;
  const csharpCount = findings.filter((f) => f.type === 'csharp-learning').length;
  const safetyCount = findings.filter((f) => f.type === 'logic-safety').length;
  const otherCount = findings.length - semCount - constCount - dtoCount - ruleCount - csharpCount - safetyCount;

  const highCount = findings.filter((f) => f.severity === 'high').length;
  const medCount = findings.filter((f) => f.severity === 'medium').length;
  const lowCount = findings.length - highCount - medCount;

  let body = `${SUMMARY_MARKER}\n`;
  body += `## 🔍 AI Code Review Summary\n\n`;
  body += `| Category | Count |\n|---|---|\n`;
  if (semCount) body += `| Semantic Duplications | **${semCount}** |\n`;
  if (constCount) body += `| Constant Duplications | **${constCount}** |\n`;
  if (dtoCount) body += `| DTO Shape Duplications | **${dtoCount}** |\n`;
  if (ruleCount) body += `| Project Rule Violations | **${ruleCount}** |\n`;
  if (csharpCount) body += `| C# Improvements | **${csharpCount}** |\n`;
  if (safetyCount) body += `| Logic Safety Warnings | **${safetyCount}** |\n`;
  if (otherCount) body += `| Other | **${otherCount}** |\n`;
  body += `| **Total** | **${findings.length}** |\n\n`;

  body += `**Severity:** ${highCount} high · ${medCount} medium · ${lowCount} low\n\n`;

  // Files affected
  const files = [...new Set(findings.map((f) => f.file).filter(Boolean))];
  if (files.length > 0) {
    body += `**Files affected:** ${files.map((f) => `\`${f}\``).join(', ')}\n\n`;
  }

  body += `---\n\n`;
  body += `### 🚀 One-Click Fix — Cursor Agent Prompt\n\n`;
  body += `Copy the prompt below and paste it into **Cursor Agent** (Cmd/Ctrl+I → Agent) to fix all findings:\n\n`;

  const cursorPrompt = buildCursorPrompt(findings);

  body += `<details><summary><b>📋 Click to expand Cursor prompt</b></summary>\n\n`;
  body += '````\n';
  body += cursorPrompt;
  body += '````\n\n';
  body += `</details>\n\n`;

  body += `---\n`;
  body += `<sub>AI Review • ${new Date().toISOString().slice(0, 10)} • ${findings.length} finding(s)</sub>\n`;

  return body;
}

async function maybePostSummaryComment(findings) {
  if (!findings || findings.length === 0) return;

  try {
    const comments = await listIssueComments();
    const existingIdx = Array.isArray(comments)
      ? comments.findIndex((c) => String(c?.body || '').includes(SUMMARY_MARKER))
      : -1;

    const body = buildSummaryComment(findings);

    if (existingIdx >= 0) {
      const commentId = comments[existingIdx].id;
      const res = await fetch(`${apiBase}/issues/comments/${commentId}`, {
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
        const t = await res.text();
        throw new Error(`Update summary comment API ${res.status}: ${t}`);
      }
      console.log('Updated existing summary comment.');
    } else {
      await postIssueComment(body);
      console.log('Posted new summary comment.');
    }
  } catch (e) {
    console.log(`Warning: failed to post summary comment. ${e?.message || e}`);
  }
}

async function maybePostApplyRefactorHint() {
  try {
    const comments = await listIssueComments();
    const already = Array.isArray(comments) && comments.some((c) => String(c?.body || '').includes(APPLY_REFACTOR_HINT_MARKER));
    if (already) return;

    const body =
      `${APPLY_REFACTOR_HINT_MARKER}\n` +
      `To have the AI apply safe refactors for these findings (requires approval), add a PR comment:\n\n` +
      `\`/ai-apply-refactor\``;
    await postIssueComment(body);
  } catch (e) {
    // Reliability-first: never fail the workflow because the hint couldn't be posted.
    console.log(`Warning: failed to post apply-refactor hint. ${e?.message || e}`);
  }
}

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
  const existingKeys = new Set();
  try {
    const existing = await listReviewComments();
    for (const c of Array.isArray(existing) ? existing : []) {
      const body = String(c?.body || '');
      if (!body.includes(FINDING_MARKER_PREFIX)) continue;
      const match = body.match(/<!-- ai-finding-key:\s*([^>]+)\s*-->/);
      if (match && match[1]) existingKeys.add(match[1].trim());
    }
  } catch (e) {
    // If we can't list comments, keep going; we'll still post anchored comments.
    console.log(`Warning: failed to list existing review comments for dedupe. ${e?.message || e}`);
  }

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
    const key = findingKey(f);
    if (existingKeys.has(key)) {
      console.log(`Skip (already commented): ${f.type} ${f.method || f.title || '—'}`);
      continue;
    }

    const body = `${formatCommentBody(f)}\n\n${markerForFinding(f)}`;
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
      for (const [k, locs] of methodLocations.entries()) {
        if (k.endsWith(`::${methodName}`) && locs && locs.length > 0) {
          firstLoc = locs[0];
          break;
        }
      }
    }

    // Fallback: anchor on the first hunk line of the file (e.g. when the method signature
    // is a context line not directly in the hunk, but the file IS in the diff).
    if (!firstLoc && filePath) {
      const ranges = hunkRanges.get(filePath) || [];
      if (ranges.length > 0) {
        firstLoc = { path: filePath, line: ranges[0].start };
        console.log(`Fallback anchor at first hunk line: ${firstLoc.path}:${firstLoc.line}`);
      }
    }

    // Last resort for semantic-duplication: if the finding's file isn't in the diff
    // (e.g. the PR method was extracted from a file with only whitespace changes),
    // try anchoring on the matchingFile if it has hunks, or on the first diff file.
    if (!firstLoc && f.type === 'semantic-duplication') {
      const matchFile = normalizeRepoPath(f.matchingFile || '');
      if (matchFile) {
        const ranges = hunkRanges.get(matchFile) || [];
        if (ranges.length > 0) {
          firstLoc = { path: matchFile, line: ranges[0].start };
          console.log(`Fallback anchor on matching file: ${firstLoc.path}:${firstLoc.line}`);
        }
      }
      if (!firstLoc) {
        for (const [diffPath, ranges] of hunkRanges.entries()) {
          if (ranges.length > 0) {
            firstLoc = { path: diffPath, line: ranges[0].start };
            console.log(`Fallback anchor on first diff file: ${firstLoc.path}:${firstLoc.line}`);
            break;
          }
        }
      }
    }

    if (!prHeadSha || !firstLoc) {
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

  // Post summary with one-click Cursor prompt
  await maybePostSummaryComment(findings);

  // UX: Post once as a single PR (issue) comment so devs discover /ai-apply-refactor.
  await maybePostApplyRefactorHint();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
