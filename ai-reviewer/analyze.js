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

// Project policy: any similarity >= 70% should be refactored.
const SIMILARITY_THRESHOLD = 0.70;
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
function extractCSharpMethods(source, filePath = '') {
  const methods = [];
  // Intentionally simple (regex-based) but avoids false positives by requiring an access modifier.
  // This helps prevent extracting framework call sites like Ok() as "methods".
  const methodRegex = /\b(public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?([\w<>\[\], ?]+)\s+(\w+)\s*\([^)]*\)\s*(?:where[^{]+)?\s*\{/g;
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
    const name = match[3];
    const returnType = (match[2] || '').trim();
    const startLine = source.slice(0, start).split('\n').length; // 1-based
    methods.push({ file: filePath, line: startLine, name, returnType, text: methodText });
  }
  return methods;
}

function extractCSharpMethodsFromMainCode(mainCode) {
  const lines = String(mainCode || '').split('\n');
  let currentFile = '';
  let buf = [];
  const out = [];

  const flush = () => {
    if (buf.length === 0) return;
    const chunk = buf.join('\n');
    out.push(...extractCSharpMethods(chunk, currentFile || 'main_code.cs'));
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(/^\s*\/\/\s*FILE:\s*(.+)\s*$/);
    if (m) {
      flush();
      currentFile = (m[1] || '').trim();
      continue;
    }
    buf.push(line);
  }
  flush();
  return out;
}

function extractCSharpConstants(source, filePath = '') {
  const out = [];
  const lines = String(source || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    // Single-line const declarations only (reliability-first).
    const m = line.match(/\bconst\s+([\w<>\[\], ?]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;]+)\s*;/);
    if (!m) continue;
    const type = (m[1] || '').trim();
    const name = (m[2] || '').trim();
    const valueRaw = (m[3] || '').trim();
    const valueNormalized = valueRaw.replace(/\s+/g, '');
    out.push({
      file: filePath,
      line: i + 1,
      type,
      name,
      valueRaw,
      valueNormalized,
    });
  }
  return out;
}

function extractCSharpConstantsFromMainCode(mainCode) {
  const lines = String(mainCode || '').split('\n');
  let currentFile = '';
  let buf = [];
  const out = [];

  const flush = () => {
    if (buf.length === 0) return;
    const chunk = buf.join('\n');
    out.push(...extractCSharpConstants(chunk, currentFile || 'main_code.cs'));
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(/^\s*\/\/\s*FILE:\s*(.+)\s*$/);
    if (m) {
      flush();
      currentFile = (m[1] || '').trim();
      continue;
    }
    buf.push(line);
  }
  flush();
  return out;
}

function extractDtoLikeClassShapes(source, filePath = '') {
  const out = [];
  const src = String(source || '');
  const isDtoFile = (filePath || '').includes('/Models/');

  const classRegex = /\bpublic\s+(?:sealed\s+)?(?:partial\s+)?(class|record)\s+(\w+)\b[^{;]*\{/g;
  let match;
  while ((match = classRegex.exec(src)) !== null) {
    const kind = match[1];
    const name = match[2];
    const start = match.index;
    const openBrace = src.indexOf('{', start);
    if (openBrace < 0) continue;

    let depth = 1;
    let i = openBrace + 1;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }
    const end = i;
    if (end <= openBrace) continue;
    const body = src.slice(openBrace + 1, end - 1);

    const startLine = src.slice(0, start).split('\n').length;
    const props = [];
    const propRegex = /\bpublic\s+([\w<>\[\], ?]+)\s+(\w+)\s*\{\s*get;\s*(?:set;|init;)\s*\}/g;
    let pm;
    while ((pm = propRegex.exec(body)) !== null) {
      const t = (pm[1] || '').replace(/\s+/g, ' ').trim();
      const n = (pm[2] || '').trim();
      props.push({ type: t, name: n });
    }

    // Only consider DTO-like shapes (reduces noise).
    const isDtoName = /(Request|Response|Dto)$/i.test(name);
    if (!isDtoFile && !isDtoName) continue;
    if (props.length < 2) continue;

    const shapeKey = props
      .map((p) => `${p.type.replace(/\s+/g, '')}:${p.name}`)
      .sort()
      .join('|');

    out.push({
      file: filePath,
      line: startLine,
      kind,
      name,
      props,
      shapeKey,
    });
  }
  return out;
}

function extractDtoLikeClassShapesFromMainCode(mainCode) {
  const lines = String(mainCode || '').split('\n');
  let currentFile = '';
  let buf = [];
  const out = [];

  const flush = () => {
    if (buf.length === 0) return;
    const chunk = buf.join('\n');
    out.push(...extractDtoLikeClassShapes(chunk, currentFile || 'main_code.cs'));
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(/^\s*\/\/\s*FILE:\s*(.+)\s*$/);
    if (m) {
      flush();
      currentFile = (m[1] || '').trim();
      continue;
    }
    buf.push(line);
  }
  flush();
  return out;
}

function isPrBusinessMethodCandidate(m) {
  // Reliability-first: analyze user-created methods likely to contain migrated business logic.
  // Do NOT restrict to Services only; migrations can land in other folders during a sprint.
  const file = (m.file || '').replace(/\\/g, '/');
  if (file) {
    if (!file.startsWith('modern-app/api/')) return false;
    if (!file.endsWith('.cs')) return false;
    if (file.includes('/bin/') || file.includes('/obj/')) return false;
    if (file.endsWith('.g.cs') || file.endsWith('.AssemblyInfo.cs') || file.endsWith('.GlobalUsings.g.cs')) return false;
    if (file.endsWith('/Program.cs')) return false;
  }

  const rt = (m.returnType || '').replace(/\s+/g, '');
  if (rt.includes('IActionResult') || rt.includes('ActionResult')) return false;

  // Skip trivial wrappers to avoid noisy/extra comments.
  const lines = (m.text || '').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 6) return false;
  return true;
}

function isMainBusinessMethodCandidate(m) {
  // In the workflow, main branch code is concatenated into `main_code.cs` without per-file paths.
  // So we cannot reliably filter main methods by file path. Instead, filter out controller-like methods.
  const rt = (m.returnType || '').replace(/\s+/g, '');
  if (rt.includes('IActionResult') || rt.includes('ActionResult')) return false;

  const lines = (m.text || '').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 6) return false;
  return true;
}

function changedCSharpFilesFromDiff(diffContent) {
  const files = new Set();
  if (!diffContent || typeof diffContent !== 'string') return [];
  for (const line of diffContent.split('\n')) {
    if (!line.startsWith('+++ b/')) continue;
    const p = line.slice(6).trim();
    if (!p.endsWith('.cs')) continue;
    if (!p.startsWith('modern-app/api/')) continue;
    if (p.includes('/bin/') || p.includes('/obj/')) continue;
    if (p.endsWith('.g.cs') || p.endsWith('.AssemblyInfo.cs')) continue;
    files.add(p);
  }
  return Array.from(files);
}

function parseUnifiedDiff(diffContent) {
  const files = new Map();
  if (!diffContent || typeof diffContent !== 'string') return files;

  let currentPath = null;
  let newLine = 0;

  for (const rawLine of diffContent.split('\n')) {
    const line = rawLine ?? '';

    if (line.startsWith('+++ b/')) {
      currentPath = line.slice(6).trim();
      newLine = 0;
      if (currentPath && !files.has(currentPath)) {
        files.set(currentPath, { hunks: [], lines: [] });
      }
      continue;
    }

    if (!currentPath) continue;

    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)(?:,(\d+))?/);
      if (match) {
        const start = Number(match[1]);
        const count = match[2] ? Number(match[2]) : 1;
        newLine = start;
        files.get(currentPath)?.hunks.push({ start, count });
      }
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      files.get(currentPath)?.lines.push({ kind: '+', line: newLine, text: line.slice(1) });
      newLine++;
      continue;
    }

    if (line.startsWith(' ')) {
      files.get(currentPath)?.lines.push({ kind: ' ', line: newLine, text: line.slice(1) });
      newLine++;
      continue;
    }

    if (line.startsWith('-') && !line.startsWith('---')) {
      files.get(currentPath)?.lines.push({ kind: '-', line: null, text: line.slice(1) });
      continue;
    }
  }

  return files;
}

function isScriptFile(filePath) {
  const p = (filePath || '').replace(/\\/g, '/');
  if (!p) return false;
  if (p.startsWith('scripts/') || p.startsWith('modern-app/scripts/')) return true;
  const lower = p.toLowerCase();
  return (
    lower.endsWith('.sql') ||
    lower.endsWith('.ps1') ||
    lower.endsWith('.sh') ||
    lower.endsWith('.bat') ||
    lower.endsWith('.cmd')
  );
}

function findLineNumberFromIndex(text, index) {
  if (index <= 0) return 1;
  return text.slice(0, index).split('\n').length;
}

function firstHunkLine(parsedFile) {
  const h = parsedFile?.hunks?.[0];
  return h?.start || 1;
}

function fileBaseName(p) {
  const s = (p || '').replace(/\\/g, '/');
  return s.split('/').pop() || s;
}

function runProjectSpecificChecks(prDiffRaw, findings) {
  const parsed = parseUnifiedDiff(prDiffRaw);
  const changedApiFiles = new Set();
  const changedTestFiles = new Set();
  const maxLearningSuggestionsTotal = 12;
  const maxLearningSuggestionsPerFile = 3;
  let learningSuggestionsTotal = 0;

  // ---- Script rules ----
  for (const [file, info] of parsed.entries()) {
    if (!isScriptFile(file)) continue;

    const abs = path.join(repoRoot, file);
    const content = readFileSafe(abs);
    const anchorLine = firstHunkLine(info);
    const base = fileBaseName(file);

    // 1) Jira ticket in file name
    if (!/IMKSA-\d+/i.test(base)) {
      findings.push(finding(
        'project-rule',
        'high',
        'Script filename must include Jira ticket',
        `Script files must include a Jira ticket key in the filename (e.g. IMKSA-1234). Found: ${base}`,
        {
          file,
          line: anchorLine,
          cursorPrompt: `Rename this script file to include a Jira ticket key like IMKSA-1234, and update any references if needed.`,
          suggestedAction: 'Rename the script file to include the Jira ticket key.',
        }
      ));
    }

    // 9) Developer name above script
    if (content) {
      const firstNonEmpty = content.split('\n').find((l) => l.trim().length > 0) || '';
      if (!/developer\s*:\s*[A-Za-z][A-Za-z0-9 _.-]{2,}/i.test(firstNonEmpty)) {
        findings.push(finding(
          'project-rule',
          'medium',
          'Script must declare developer name at top',
          'Every script file must include the developer name in the first non-empty line (e.g. `-- Developer: Jane Doe`).',
          {
            file,
            line: anchorLine,
            cursorPrompt: `Add a developer header as the first non-empty line, e.g. \"-- Developer: <Your Name>\" (or \"# Developer: <Your Name>\" for shell scripts).`,
            suggestedAction: 'Add a developer header to the top of the script.',
          }
        ));
      }
    }

    if (!content) continue;

    // 2/3/4/7/8) SQL object naming conventions and table requirements
    const procRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+("?)([A-Za-z0-9_]+)\1/gi;
    const pkgRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?PACKAGE\s+("?)([A-Za-z0-9_]+)\1/gi;
    const fnRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+("?)([A-Za-z0-9_]+)\1/gi;
    const tableRegex = /CREATE\s+TABLE\s+("?)([A-Za-z0-9_]+)\1/gi;

    let m;
    while ((m = procRegex.exec(content)) !== null) {
      const name = m[2];
      if (!name.startsWith('DBP_')) {
        findings.push(finding('project-rule', 'high', 'Stored procedure name must start with DBP_', `Procedure \`${name}\` should be prefixed with \`DBP_\`.`, {
          file,
          line: findLineNumberFromIndex(content, m.index),
          cursorPrompt: `Rename procedure ${name} to DBP_<name> and update any references/calls.`,
          suggestedAction: 'Rename the procedure to use the DBP_ prefix.',
        }));
      }
    }

    while ((m = pkgRegex.exec(content)) !== null) {
      const name = m[2];
      if (!name.startsWith('DBPKG_')) {
        findings.push(finding('project-rule', 'high', 'Oracle package name must start with DBPKG_', `Package \`${name}\` should be prefixed with \`DBPKG_\`.`, {
          file,
          line: findLineNumberFromIndex(content, m.index),
          cursorPrompt: `Rename package ${name} to DBPKG_<name> and update any references.`,
          suggestedAction: 'Rename the package to use the DBPKG_ prefix.',
        }));
      }
    }

    while ((m = fnRegex.exec(content)) !== null) {
      const name = m[2];
      if (!name.startsWith('DBF_')) {
        findings.push(finding('project-rule', 'high', 'Oracle function name must start with DBF_', `Function \`${name}\` should be prefixed with \`DBF_\`.`, {
          file,
          line: findLineNumberFromIndex(content, m.index),
          cursorPrompt: `Rename function ${name} to DBF_<name> and update any references.`,
          suggestedAction: 'Rename the function to use the DBF_ prefix.',
        }));
      }
    }

    const hasAnyIndex = /CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(content);
    const hasAnySequence = /CREATE\s+SEQUENCE\b/i.test(content);

    while ((m = tableRegex.exec(content)) !== null) {
      const name = m[2];
      const tableLine = findLineNumberFromIndex(content, m.index);

      if (!name.startsWith('TBHUB_')) {
        findings.push(finding('project-rule', 'high', 'DB table name must start with TBHUB_', `Table \`${name}\` should be prefixed with \`TBHUB_\`.`, {
          file,
          line: tableLine,
          cursorPrompt: `Rename table ${name} to TBHUB_<name> and update any references.`,
          suggestedAction: 'Rename the table to use the TBHUB_ prefix.',
        }));
      }

      // 8) indexes + sequences
      if (!hasAnyIndex || !hasAnySequence) {
        findings.push(finding(
          'project-rule',
          'high',
          'New tables must include indexes and sequences',
          `New table \`${name}\` should have supporting CREATE INDEX statements and a CREATE SEQUENCE in the same script.`,
          {
            file,
            line: tableLine,
            cursorPrompt: `Add CREATE INDEX statements for key columns on ${name}, and add a CREATE SEQUENCE (and optionally a trigger) for primary key generation.`,
            suggestedAction: 'Add missing CREATE INDEX and/or CREATE SEQUENCE statements for the new table.',
          }
        ));
      }
    }
  }

  // ---- C# rules (diff-based so we comment on correct lines) ----
  for (const [file, info] of parsed.entries()) {
    const norm = (file || '').replace(/\\/g, '/');
    if (!norm.startsWith('modern-app/api/')) continue;
    if (!norm.endsWith('.cs')) continue;
    if (norm.includes('/bin/') || norm.includes('/obj/')) continue;
    if (norm.endsWith('.g.cs') || norm.endsWith('.AssemblyInfo.cs') || norm.endsWith('.GlobalUsings.g.cs')) continue;

    const isController = norm.includes('/Controllers/');
    if (norm.includes('/Tests/') || /test/i.test(norm)) changedTestFiles.add(norm);
    changedApiFiles.add(norm);

    let learningSuggestionsForFile = 0;

    const abs = path.join(repoRoot, norm);
    const fullContent = readFileSafe(abs);

    // API style: controllers should generally have [ApiController].
    if (isController && fullContent && !/\[\s*ApiController\s*\]/.test(fullContent)) {
      findings.push(finding(
        'project-rule',
        'medium',
        'Controllers must use [ApiController]',
        'All API controllers should include the [ApiController] attribute for consistent binding/validation behavior.',
        {
          file: norm,
          line: firstHunkLine(info),
          cursorPrompt: 'Add [ApiController] to this controller (above the class).',
          suggestedAction: 'Add the [ApiController] attribute.',
        }
      ));
    }

    // Routing: require versioned API routes (reliability/consistency).
    for (let i = 0; i < info.lines.length; i++) {
      const dl = info.lines[i];
      if (dl.kind !== '+') continue;
      const routeAttr = dl.text.match(/\[\s*Route\s*\(\s*"([^"]+)"\s*\)\s*\]/);
      if (!routeAttr) continue;
      const route = routeAttr[1] || '';
      if (route.startsWith("api/") && !/api\/v\d+\//i.test(route) && !/api\/v\{/.test(route)) {
        findings.push(finding(
          'project-rule',
          'medium',
          'API routes must be versioned',
          `Route "${route}" should be versioned (e.g. "api/v1/..." or "api/v{version}/...").`,
          {
            file: norm,
            line: dl.line || firstHunkLine(info),
            cursorPrompt: 'Update the [Route] to include an API version segment (e.g., "api/v1/[controller]").',
            suggestedAction: 'Version the API route.',
          }
        ));
      }
    }

    // 5) C# const must be ALL CAPS (only check added lines to avoid noise on existing code)
    for (let i = 0; i < info.lines.length; i++) {
      const dl = info.lines[i];
      if (dl.kind !== '+') continue;
      const constMatch = dl.text.match(/\bconst\s+[\w<>\[\], ?]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (!constMatch) continue;
      const name = constMatch[1];
      if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
        findings.push(finding(
          'project-rule',
          'medium',
          'C# constants must be ALL CAPS',
          `Constant \`${name}\` should be renamed to ALL_CAPS per project convention.`,
          {
            file: norm,
            line: dl.line || firstHunkLine(info),
            cursorPrompt: `Rename constant ${name} to an ALL_CAPS name (e.g. ${name.toUpperCase()}) and update all references.`,
            suggestedAction: 'Rename the constant to ALL_CAPS and update references.',
          }
        ));
      }
    }

    // Common safety rules on added lines (low-noise, deterministic)
    for (let i = 0; i < info.lines.length; i++) {
      const dl = info.lines[i];
      if (dl.kind !== '+') continue;

      // No Console.WriteLine in production code.
      if (/\b(Console|System\.Console)\s*\./.test(dl.text)) {
        findings.push(finding(
          'project-rule',
          'medium',
          'Avoid Console logging',
          'Do not use Console logging in application code; use structured ILogger instead.',
          {
            file: norm,
            line: dl.line || firstHunkLine(info),
            cursorPrompt: 'Replace Console usage with injected ILogger<T> and structured log messages.',
            suggestedAction: 'Use ILogger instead of Console.',
          }
        ));
      }

      // No blocking async: .Result/.Wait()/GetAwaiter().GetResult()
      if (/\.\s*Result\b/.test(dl.text) || /\.\s*Wait\s*\(\s*\)/.test(dl.text) || /GetAwaiter\(\)\.GetResult\(\)/.test(dl.text)) {
        findings.push(finding(
          'project-rule',
          'high',
          'Avoid blocking async calls',
          'Blocking on Tasks (.Result/.Wait/GetAwaiter().GetResult()) can cause deadlocks and thread starvation.',
          {
            file: norm,
            line: dl.line || firstHunkLine(info),
            cursorPrompt: 'Make the call async/await end-to-end (mark method async, return Task/Task<T>, await the operation).',
            suggestedAction: 'Use async/await instead of blocking on tasks.',
          }
        ));
      }

      // Avoid DateTime.Now
      if (/\bDateTime\.Now\b/.test(dl.text)) {
        findings.push(finding(
          'project-rule',
          'medium',
          'Avoid DateTime.Now',
          'Use DateTimeOffset.UtcNow (or a clock abstraction) to avoid timezone/locale issues.',
          {
            file: norm,
            line: dl.line || firstHunkLine(info),
            cursorPrompt: 'Replace DateTime.Now with DateTimeOffset.UtcNow (or inject IClock/TimeProvider).',
            suggestedAction: 'Use UTC time (DateTimeOffset.UtcNow).',
          }
        ));
      }

      // Avoid null-forgiving operator (`!`) except in comparisons (best-effort heuristic)
      if (/\w!\b/.test(dl.text) && !/!=/.test(dl.text)) {
        findings.push(finding(
          'project-rule',
          'low',
          'Avoid null-forgiving operator',
          'Avoid using the null-forgiving operator (!) unless you can prove the value is non-null; prefer proper validation/flow.',
          {
            file: norm,
            line: dl.line || firstHunkLine(info),
            cursorPrompt: 'Remove the null-forgiving operator and add explicit null checks/guard clauses as needed.',
            suggestedAction: 'Add proper null handling instead of using !.',
          }
        ));
      }

      // Secrets-in-code (heuristic)
      if (/(password\s*=|pwd\s*=|apikey|api_key|client_secret|-----BEGIN|sk-[A-Za-z0-9]{8,})/i.test(dl.text)) {
        findings.push(finding(
          'project-rule',
          'high',
          'Possible secret in code',
          'This line looks like it may contain a secret (password/key/token). Secrets must not be committed to the repo.',
          {
            file: norm,
            line: dl.line || firstHunkLine(info),
            cursorPrompt: 'Remove the secret from code. Use environment variables/KeyVault/Secrets Manager and rotate the credential if it was real.',
            suggestedAction: 'Remove secrets from code and use a secret store.',
          }
        ));
      }

      // Controller DB access (heuristic)
      if (isController && /\b(DbContext|SqlConnection|OracleConnection|NpgsqlConnection|MySqlConnection|FromSql|ExecuteReader|ExecuteNonQuery|Dapper)\b/.test(dl.text)) {
        findings.push(finding(
          'project-rule',
          'high',
          'No direct DB access in controllers',
          'Controllers should not directly access the database; move DB code to a repository/service layer.',
          {
            file: norm,
            line: dl.line || firstHunkLine(info),
            cursorPrompt: 'Extract DB access into a service/repository and inject it into the controller.',
            suggestedAction: 'Move DB access out of the controller.',
          }
        ));
      }

      // Static mutable state in app code (heuristic)
      if (/\bstatic\b/.test(dl.text) && !/\bstatic\s+class\b/.test(dl.text) && !/\bconst\b/.test(dl.text) && !/\breadonly\b/.test(dl.text)) {
        findings.push(finding(
          'project-rule',
          'medium',
          'Avoid static mutable state',
          'Avoid static mutable state in application code; it is hard to test and can cause concurrency bugs.',
          {
            file: norm,
            line: dl.line || firstHunkLine(info),
            cursorPrompt: 'Remove static mutable state; use DI-scoped/singleton services with proper synchronization if needed.',
            suggestedAction: 'Eliminate static mutable state.',
          }
        ));
      }

      // Structured logging: avoid interpolated strings in ILogger calls (heuristic)
      if (/\bLog(Trace|Debug|Information|Warning|Error|Critical)\s*\(\s*\$"/.test(dl.text)) {
        findings.push(finding(
          'project-rule',
          'low',
          'Use structured logging (no interpolation)',
          'Prefer message templates over interpolated strings in logs (e.g. LogInformation("User {UserId}", userId)).',
          {
            file: norm,
            line: dl.line || firstHunkLine(info),
            cursorPrompt: 'Replace interpolated log string with a message template and parameters.',
            suggestedAction: 'Use message templates for logs.',
          }
        ));
      }
    }

    // Learning tips (diff-based, low severity, capped to avoid spam)
    for (let i = 0; i < info.lines.length; i++) {
      if (learningSuggestionsTotal >= maxLearningSuggestionsTotal) break;
      if (learningSuggestionsForFile >= maxLearningSuggestionsPerFile) break;

      const dl = info.lines[i];
      if (dl.kind !== '+') continue;
      const text = dl.text || '';
      const lineNo = dl.line || firstHunkLine(info);

      const addTip = (title, description, cursorPrompt) => {
        if (learningSuggestionsTotal >= maxLearningSuggestionsTotal) return;
        if (learningSuggestionsForFile >= maxLearningSuggestionsPerFile) return;
        findings.push(finding(
          'csharp-learning',
          'low',
          title,
          description,
          {
            file: norm,
            line: lineNo,
            cursorPrompt,
            suggestedAction: 'Consider using the modern C# alternative.',
          }
        ));
        learningSuggestionsTotal++;
        learningSuggestionsForFile++;
      };

      // string.Format -> interpolation
      if (/\bstring\.Format\s*\(/i.test(text)) {
        addTip(
          'C# tip: Prefer string interpolation over string.Format',
          'String interpolation is usually more readable than string.Format for composing strings.',
          'Replace string.Format(...) with an interpolated string ($"...") if it improves readability.'
        );
        continue;
      }

      // Multiple string concatenations with literals -> interpolation
      if (text.includes('"') && /\+/.test(text) && (text.match(/\+/g) || []).length >= 2 && !/\+\+/.test(text)) {
        addTip(
          'C# tip: Consider string interpolation',
          'This looks like multiple string concatenations; interpolation can be clearer and less error-prone.',
          'Refactor to string interpolation ($"...") if the intent is string building.'
        );
        continue;
      }

      // Loop concatenation -> StringBuilder
      const inLoopWindow = info.lines.slice(Math.max(0, i - 10), i + 1).some((l) => (l?.text || '').match(/\b(for|foreach)\s*\(/));
      if (inLoopWindow && /\b\w+\s*\+=\s*".*"/.test(text)) {
        addTip(
          'C# tip: Use StringBuilder for concatenation in loops',
          'Repeated string concatenation in a loop can allocate many intermediate strings; StringBuilder is often a better fit.',
          'Use a StringBuilder, Append(...) inside the loop, then builder.ToString() at the end.'
        );
        continue;
      }

      // ArgumentNullException -> ThrowIfNull
      if (/throw\s+new\s+ArgumentNullException\s*\(\s*nameof\s*\(/.test(text) || /\bArgumentNullException\s*\(\s*nameof\s*\(/.test(text)) {
        addTip(
          'C# tip: Use ArgumentNullException.ThrowIfNull',
          'C# provides ArgumentNullException.ThrowIfNull(x) for concise null argument checks.',
          'Replace manual ArgumentNullException(nameof(x)) with ArgumentNullException.ThrowIfNull(x) where applicable.'
        );
        continue;
      }

      // using(...) -> using declaration
      if (/^\s*using\s*\(\s*(var|[\w<>\[\]]+)\s+\w+\s*=/.test(text)) {
        addTip(
          'C# tip: Prefer using declarations',
          'Using declarations (using var x = ...) reduce nesting compared to using(...) { ... }.',
          'Consider using a using declaration: `using var resource = ...;` if it fits the scope.'
        );
        continue;
      }

      // Tuple -> value tuple
      if (/\bTuple\.Create\s*\(/.test(text) || /\bnew\s+Tuple\s*</.test(text)) {
        addTip(
          'C# tip: Prefer value tuples over Tuple',
          'Value tuples ((a, b)) are more idiomatic and often easier to read than Tuple<T1,T2>.',
          'Consider switching Tuple/Create to a value tuple, optionally with named elements.'
        );
        continue;
      }

      // Target-typed new
      if (/\b(List|Dictionary|HashSet|Queue|Stack)<[^>]+>\s+\w+\s*=\s*new\s+\1<[^>]+>\s*\(\s*\)/.test(text)) {
        addTip(
          'C# tip: Use target-typed new()',
          'Target-typed `new()` can reduce repetition when the type is already specified on the left.',
          'Replace `new Type<...>()` with `new()` where it improves readability.'
        );
        continue;
      }

      // Suggest records for immutable DTO-like types (best-effort heuristic: class name ends with Request/Response/Dto)
      const classMatch = text.match(/^\s*public\s+class\s+(\w+)\b/);
      if (classMatch) {
        const name = classMatch[1] || '';
        if (/(Request|Response|Dto)$/i.test(name)) {
          addTip(
            'C# tip: Consider record types for immutable DTOs',
            'Records are a good fit for immutable, data-centric types (value semantics, concise syntax).',
            'If this type is intended to be immutable DTO data, consider using `record` (and `init`/`required` as appropriate).'
          );
        }
      }
    }

    // 6) API methods must use AuthFilter/Authorize except login (check newly added action methods in controllers)
    if (isController) {
      const controllerHasAuth =
        (fullContent && (/\[\s*AuthFilter\s*\]/.test(fullContent) || /\[\s*Authorize\b/.test(fullContent))) || false;

      for (let i = 0; i < info.lines.length; i++) {
        const dl = info.lines[i];
        if (dl.kind !== '+') continue;
        const sig = dl.text.match(/^\s*public\s+(?:async\s+)?(?:Task<\s*)?(?:IActionResult|ActionResult(?:<[^>]+>)?)(?:\s*>\s*)?\s+(\w+)\s*\(/);
        if (!sig) continue;
        const methodName = sig[1] || '';
        const isLogin = /login/i.test(methodName) || /login/i.test(norm);
        if (isLogin) continue;

        let hasAuth = false;
        if (controllerHasAuth) hasAuth = true;
        for (let j = Math.max(0, i - 15); j <= i; j++) {
          const t = info.lines[j]?.text || '';
          if (/\[\s*.*AuthFilter.*\]/.test(t) || /\bAuthFilter\b/.test(t) || /\[\s*Authorize\b/.test(t) || /\bAuthorize\b/.test(t)) {
            hasAuth = true;
            break;
          }
        }

        if (!hasAuth) {
          findings.push(finding(
            'project-rule',
            'high',
            'API methods must use AuthFilter',
            `Add AuthFilter to protect \`${methodName}\` (all APIs except login must use AuthFilter).`,
            {
              file: norm,
              line: dl.line || firstHunkLine(info),
              method: methodName,
              cursorPrompt: `Add [AuthFilter] (or the project's equivalent attribute) to ${methodName}, or apply it at the controller level. Exclude only login endpoints.`,
              suggestedAction: 'Add AuthFilter to the controller/method.',
            }
          ));
        }
      }
    }
  }

  // Test expectation: API changes should generally include test changes (reliability check).
  if (changedApiFiles.size > 0 && changedTestFiles.size === 0) {
    const first = Array.from(parsed.keys()).find((p) => (p || '').replace(/\\/g, '/').startsWith('modern-app/api/')) || 'modern-app/api';
    const anchor = parsed.get(first);
    findings.push(finding(
      'project-rule',
      'low',
      'API changes should include tests',
      'This PR changes API code but does not include any test changes. Add/adjust tests for new behavior where applicable.',
      {
        file: (first || '').replace(/\\/g, '/'),
        line: firstHunkLine(anchor),
        cursorPrompt: 'Add or update unit/integration tests covering the new/changed API/service behavior.',
        suggestedAction: 'Add/adjust tests for the changed code.',
      }
    ));
  }
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
  const mainEmbeddingCache = new Map();
  for (const prMethod of prMethods) {
    const prEmbedding = await getEmbedding(prMethod.text);
    let best = null;
    for (const mainMethod of mainMethods) {
      let mainEmbedding = mainEmbeddingCache.get(mainMethod.text);
      if (!mainEmbedding) {
        mainEmbedding = await getEmbedding(mainMethod.text);
        mainEmbeddingCache.set(mainMethod.text, mainEmbedding);
      }
      const similarity = cosineSimilarity(prEmbedding, mainEmbedding);

      if (!best || similarity > best.similarity) best = { mainMethod, similarity };
    }

    if (!best) continue;
    if (best.similarity < SIMILARITY_THRESHOLD) continue;

    const { same, explanation } = await confirmSameBusinessLogicWithExplanation(prMethod.text, best.mainMethod.text);
    if (!same) continue;

    const suggestedAction = 'Consider reusing the existing method or moving shared logic to a common service.';
    const cursorPrompt = `Refactor this method to reuse the existing logic from ${best.mainMethod.name} while preserving current behavior.`;
    findings.push(finding(
      'semantic-duplication',
      'high',
      'Semantic Duplicate Detected',
      explanation,
      {
        file: prMethod.file || '',
        line: prMethod.line || 0,
        method: prMethod.name,
        matchingMethod: best.mainMethod.name,
        matchingFile: best.mainMethod.file || '',
        matchingLine: best.mainMethod.line || 0,
        similarityScore: Math.round(best.similarity * 100) / 100,
        similarityPercent: Math.round(best.similarity * 100),
        thresholdUsed: SIMILARITY_THRESHOLD,
        thresholdPercent: Math.round(SIMILARITY_THRESHOLD * 100),
        aiExplanation: explanation,
        suggestedAction,
        cursorPrompt,
      }
    ));
    console.log(`Finding: duplicate ${prMethod.name} <-> ${best.mainMethod.name} (${best.similarity.toFixed(2)})`);
  }
}

function runDuplicateConstantChecks(prDiffRaw, mainCode, findings) {
  const parsed = parseUnifiedDiff(prDiffRaw);

  const mainConsts = extractCSharpConstantsFromMainCode(mainCode);
  const byTypeAndValue = new Map();
  for (const c of mainConsts) {
    const key = `${c.type.replace(/\s+/g, '')}|${c.valueNormalized}`;
    if (!byTypeAndValue.has(key)) byTypeAndValue.set(key, c);
  }

  let emitted = 0;
  const maxFindings = 20;

  for (const [file, info] of parsed.entries()) {
    if (emitted >= maxFindings) break;
    const norm = (file || '').replace(/\\/g, '/');
    if (!norm.startsWith('modern-app/api/')) continue;
    if (!norm.endsWith('.cs')) continue;

    for (const dl of info.lines || []) {
      if (emitted >= maxFindings) break;
      if (dl.kind !== '+') continue;
      const m = (dl.text || '').match(/\bconst\s+([\w<>\[\], ?]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;]+)\s*;/);
      if (!m) continue;
      const type = (m[1] || '').trim();
      const name = (m[2] || '').trim();
      const valueRaw = (m[3] || '').trim();
      const valueNormalized = valueRaw.replace(/\s+/g, '');

      const key = `${type.replace(/\s+/g, '')}|${valueNormalized}`;
      const existing = byTypeAndValue.get(key);
      if (!existing) continue;

      // If it's the exact same constant name in the same file, don't flag.
      if (existing.name === name && existing.file === norm) continue;

      findings.push(finding(
        'constant-duplication',
        'medium',
        'Duplicate constant value detected',
        `Constant \`${name}\` duplicates an existing constant value (${type} = ${valueRaw}). Existing: \`${existing.name}\` in \`${existing.file}\`:${existing.line}.`,
        {
          file: norm,
          line: dl.line || firstHunkLine(info),
          method: '',
          matchingFile: existing.file,
          matchingLine: existing.line,
          matchingConstant: existing.name,
          suggestedAction: 'Reuse the existing constant or move shared constants into a common location.',
          cursorPrompt: `Replace ${name} with reuse of ${existing.name} (or centralize constants) and update references.`,
        }
      ));
      emitted++;
    }
  }
}

function runDtoShapeDuplicationChecks(prDiffRaw, mainCode, findings) {
  const parsed = parseUnifiedDiff(prDiffRaw);

  // Collect class declaration lines that are present in the diff (so comments can anchor reliably).
  const classAnchorsByFile = new Map();
  for (const [file, info] of parsed.entries()) {
    const norm = (file || '').replace(/\\/g, '/');
    if (!norm.startsWith('modern-app/api/')) continue;
    if (!norm.endsWith('.cs')) continue;

    for (const dl of info.lines || []) {
      if (dl.kind !== '+') continue;
      const m = (dl.text || '').match(/^\s*public\s+(?:sealed\s+)?(?:partial\s+)?(?:class|record)\s+(\w+)\b/);
      if (!m) continue;
      if (!classAnchorsByFile.has(norm)) classAnchorsByFile.set(norm, new Set());
      classAnchorsByFile.get(norm).add(dl.line || firstHunkLine(info));
    }
  }

  const mainDtos = extractDtoLikeClassShapesFromMainCode(mainCode);
  const byShape = new Map();
  for (const d of mainDtos) {
    if (!byShape.has(d.shapeKey)) byShape.set(d.shapeKey, d);
  }

  let emitted = 0;
  const maxFindings = 10;

  for (const [file, anchors] of classAnchorsByFile.entries()) {
    if (emitted >= maxFindings) break;
    const abs = path.join(repoRoot, file);
    const src = readFileSafe(abs);
    if (!src) continue;

    const prDtos = extractDtoLikeClassShapes(src, file);
    for (const d of prDtos) {
      if (emitted >= maxFindings) break;
      if (!anchors.has(d.line)) continue;

      const existing = byShape.get(d.shapeKey);
      if (!existing) continue;
      if (existing.name === d.name) continue;

      const propsList = d.props.map((p) => `${p.type} ${p.name}`).join(', ');
      findings.push(finding(
        'dto-shape-duplication',
        'medium',
        'DTO shape duplicate detected',
        `DTO \`${d.name}\` has the same property shape as existing \`${existing.name}\` in \`${existing.file}\`:${existing.line}. Properties: ${propsList}.`,
        {
          file,
          line: d.line,
          matchingFile: existing.file,
          matchingLine: existing.line,
          matchingType: existing.name,
          suggestedAction: 'Reuse the existing DTO type or consolidate to a single shared model and map at boundaries.',
          cursorPrompt: `Replace ${d.name} with reuse of ${existing.name} (or consolidate DTOs) and update references/mappings.`,
        }
      ));
      emitted++;
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
          file: prMethod.file || '',
          line: prMethod.line || 0,
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
  const coreChecks = rules.layers.core?.checks || ['semantic-duplication'];

  const prDiffRaw = readFileSafe(prDiffFile);
  const mainCode = readFileSafe(mainCodeFile);
  const changedFiles = changedCSharpFilesFromDiff(prDiffRaw);

  const prMethods = [];
  for (const f of changedFiles) {
    const abs = path.join(repoRoot, f);
    const src = readFileSafe(abs);
    if (!src) continue;
    prMethods.push(...extractCSharpMethods(src, f));
  }

  // Fallback: if we couldn't resolve changed files (e.g. diff truncated), at least try added code.
  if (prMethods.length === 0) {
    const prCode = codeFromDiff(prDiffRaw) || mainCode;
    prMethods.push(...extractCSharpMethods(prCode, ''));
  }

  const mainMethods = extractCSharpMethodsFromMainCode(mainCode);

  const prBusinessMethods = prMethods.filter(isPrBusinessMethodCandidate);
  const mainBusinessMethods = mainMethods.filter(isMainBusinessMethodCandidate);

  if (mainBusinessMethods.length === 0) {
    console.log('No baseline (main) business methods found after filtering; semantic duplication cannot be detected.');
  }

  if (prBusinessMethods.length === 0) {
    console.log('No C# methods found in PR diff / code. Skipping AI review.');
    const outPath = path.isAbsolute(findingsOutput) ? findingsOutput : path.resolve(process.cwd(), findingsOutput);
    fs.writeFileSync(outPath, JSON.stringify([], null, 2));
    return;
  }

  console.log(`PR methods: ${prBusinessMethods.length}, Main methods: ${mainBusinessMethods.length}. Running: ${coreChecks.join(', ')}`);
  const findings = [];

  if (coreChecks.includes('semantic-duplication')) {
    await runSemanticDuplication(prBusinessMethods, mainBusinessMethods, findings);
  }

  // Project-specific checks (no LLM required; reliability-first, diff-anchored where possible)
  runProjectSpecificChecks(prDiffRaw, findings);

  // Additional semantic duplication types (deterministic; no LLM required)
  runDuplicateConstantChecks(prDiffRaw, mainCode, findings);
  runDtoShapeDuplicationChecks(prDiffRaw, mainCode, findings);

  const outPath = path.isAbsolute(findingsOutput) ? findingsOutput : path.resolve(process.cwd(), findingsOutput);
  fs.writeFileSync(outPath, JSON.stringify(findings, null, 2));
  console.log(`Wrote ${findings.length} finding(s) to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
