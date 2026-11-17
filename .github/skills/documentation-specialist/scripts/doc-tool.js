#!/usr/bin/env node
/**
 * Documentation & Skill Synchronization Tool (Zero-dependency Node.js CLI)
 * Part of agent-skills-synchronizer (SkillSyncPro)
 *
 * Commands:
 *   node doc-tool.js validate <file-or-dir>
 *   node doc-tool.js audit-sync <targetFile> <refFile>
 *   node doc-tool.js inspect-codebase [dir]
 */

const fs = require('node:fs');
const path = require('node:path');

// --- Helper Functions ---

function isDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function isFile(targetPath) {
  try {
    return fs.statSync(targetPath).isFile();
  } catch {
    return false;
  }
}

function getAllMarkdownFiles(dirPath, fileList = []) {
  if (!fs.existsSync(dirPath)) return fileList;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    // Ignore common noisy directories
    if (['node_modules', '.git', 'dist', 'build', '.skillsync', 'backup'].includes(entry.name)) {
      continue;
    }
    if (entry.isDirectory()) {
      getAllMarkdownFiles(fullPath, fileList);
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

// --- 1. Validation Logic ---

function validateMarkdownFile(filePath) {
  const issues = [];
  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return [{ type: 'ERROR', message: `Cannot read file: ${err.message}` }];
  }

  const lines = content.split(/\r?\n/);
  const dir = path.dirname(filePath);

  // 1. Check YAML Frontmatter
  let hasFrontmatter = false;
  let inFrontmatter = false;
  let frontmatterEndLine = -1;
  const frontmatterLines = [];

  if (lines.length > 0 && lines[0].trim() === '---') {
    hasFrontmatter = true;
    inFrontmatter = true;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        inFrontmatter = false;
        frontmatterEndLine = i;
        break;
      }
      frontmatterLines.push(lines[i]);
    }

    if (inFrontmatter) {
      issues.push({ line: 1, type: 'ERROR', message: 'Unclosed YAML frontmatter (missing closing ---)' });
    } else {
      // Validate frontmatter properties if this looks like a skill or spec
      const fmText = frontmatterLines.join('\n');
      if (path.basename(filePath) === 'SKILL.md') {
        if (!/^\s*name\s*:\s*.+/m.test(fmText)) {
          issues.push({ line: 1, type: 'ERROR', message: 'SKILL.md frontmatter missing required "name" field' });
        }
        if (!/^\s*description\s*:\s*.+/m.test(fmText)) {
          issues.push({ line: 1, type: 'ERROR', message: 'SKILL.md frontmatter missing required "description" field' });
        }
      }
    }
  }

  // 2. Check Code Blocks & Headings & Links
  let inCodeBlock = false;
  let codeBlockChar = '';
  let codeBlockLength = 0;
  let prevHeadingLevel = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1;
    const line = lines[idx];

    // Code block check (supports nested blocks like ```` enclosing ```)
    const codeMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
    if (codeMatch) {
      const fenceChar = codeMatch[2][0];
      const fenceLen = codeMatch[2].length;
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockChar = fenceChar;
        codeBlockLength = fenceLen;
      } else if (fenceChar === codeBlockChar && fenceLen >= codeBlockLength) {
        inCodeBlock = false;
      }
      continue;
    }

    // Skip internal checks if inside code block or frontmatter
    if (inCodeBlock || (hasFrontmatter && lineNum <= frontmatterEndLine + 1)) {
      continue;
    }

    // Heading hierarchy check
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      if (!title) {
        issues.push({ line: lineNum, type: 'WARN', message: `Empty heading level ${level}` });
      }
      if (prevHeadingLevel > 0 && level > prevHeadingLevel + 1) {
        issues.push({
          line: lineNum,
          type: 'WARN',
          message: `Heading level skipped: from H${prevHeadingLevel} to H${level}`
        });
      }
      prevHeadingLevel = level;
    }

    // Link integrity check: [text](target)
    const linkRegex = /!?\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      let target = match[2].trim();
      // Remove fragment / anchor (#section)
      const hashIndex = target.indexOf('#');
      if (hashIndex !== -1) {
        target = target.slice(0, hashIndex);
      }
      // If target is just anchor or empty, skip
      if (!target) continue;

      // Skip external protocols or special schemes
      if (/^(https?|ftp|mailto|file|conversation):/i.test(target)) {
        continue;
      }

      // Check if target is a template placeholder (e.g. 'link', 'url', '<path>', '{target}')
      const isPlaceholder = ['link', 'url', 'path', 'target', 'image.png'].includes(target.toLowerCase()) ||
                            target.includes('<') || target.includes('{') ||
                            ((filePath.includes('templates') || filePath.includes('examples')) && target.startsWith('images/'));
      if (isPlaceholder) {
        continue;
      }

      // Resolve relative path
      const resolvedTarget = path.resolve(dir, target);
      if (!fs.existsSync(resolvedTarget)) {
        issues.push({
          line: lineNum,
          type: 'ERROR',
          message: `Broken relative link target '${match[2]}': file not found at '${resolvedTarget}'`
        });
      }
    }

    // Check for hardcoded local machine paths (e.g. /home/alice/... or C:\Users\bob\...)
    // Ignore if inside backticks or common illustrative examples (user, username, your-username)
    const lineWithoutCode = line.replace(/`[^`]+`/g, '');
    const pathMatch = lineWithoutCode.match(/(?:\/home\/([a-zA-Z0-9_-]+)\/|[A-Za-z]:\\[Uu]sers\\([a-zA-Z0-9_-]+)\/)/);
    if (pathMatch) {
      const capturedUser = (pathMatch[1] || pathMatch[2] || '').toLowerCase();
      if (!['user', 'username', 'your-name', 'example'].includes(capturedUser)) {
        issues.push({
          line: lineNum,
          type: 'WARN',
          message: 'Potential non-portable hardcoded absolute local path detected'
        });
      }
    }
  }

  if (inCodeBlock) {
    issues.push({ line: lines.length, type: 'ERROR', message: 'Unclosed code block at end of file' });
  }

  return issues;
}

function runValidate(targetPath) {
  const resolved = path.resolve(process.cwd(), targetPath || '.');
  console.log(`[doc-tool] Validating documentation at: ${resolved}`);

  let files = [];
  if (isDirectory(resolved)) {
    files = getAllMarkdownFiles(resolved);
  } else if (isFile(resolved)) {
    files = [resolved];
  } else {
    console.error(`[ERROR] Target path does not exist: ${resolved}`);
    process.exit(1);
  }

  let totalFiles = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of files) {
    totalFiles++;
    const issues = validateMarkdownFile(file);
    const relPath = path.relative(process.cwd(), file);

    const errors = issues.filter((i) => i.type === 'ERROR');
    const warnings = issues.filter((i) => i.type === 'WARN');

    totalErrors += errors.length;
    totalWarnings += warnings.length;

    if (issues.length > 0) {
      console.log(`\n📄 ${relPath} (${errors.length} errors, ${warnings.length} warnings):`);
      for (const issue of issues) {
        const prefix = issue.type === 'ERROR' ? '  ✖ [ERROR]' : '  ⚠ [WARN]';
        const lineInfo = issue.line ? `Line ${issue.line}: ` : '';
        console.log(`${prefix} ${lineInfo}${issue.message}`);
      }
    }
  }

  console.log('\n======================================================');
  console.log(`[doc-tool] Validation Summary:`);
  console.log(`  Scanned Files : ${totalFiles}`);
  console.log(`  Errors        : ${totalErrors}`);
  console.log(`  Warnings      : ${totalWarnings}`);
  console.log('======================================================');

  if (totalErrors > 0) {
    console.error(`\n❌ Validation FAILED with ${totalErrors} error(s).`);
    process.exit(1);
  } else {
    console.log(`\n✔ Validation PASSED.`);
  }
}

// --- 2. Audit-Sync Logic ---

function extractHeadings(content) {
  const headings = [];
  const lines = content.split(/\r?\n/);
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```') || line.trim().startsWith('~~~')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;

    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      headings.push({
        line: i + 1,
        level: m[1].length,
        title: m[2].trim(),
        cleanTitle: m[2].replace(/[0-9.]+\s*/, '').trim().toLowerCase()
      });
    }
  }
  return headings;
}

function runAuditSync(targetFile, refFile) {
  if (!targetFile || !refFile) {
    console.error('Usage: node doc-tool.js audit-sync <targetFile> <referenceFile>');
    process.exit(1);
  }

  const resolvedTarget = path.resolve(process.cwd(), targetFile);
  const resolvedRef = path.resolve(process.cwd(), refFile);

  if (!isFile(resolvedTarget)) {
    console.error(`[ERROR] Target file not found: ${resolvedTarget}`);
    process.exit(1);
  }
  if (!isFile(resolvedRef)) {
    console.error(`[ERROR] Reference file not found: ${resolvedRef}`);
    process.exit(1);
  }

  console.log(`[doc-tool] Auditing synchronization compatibility:`);
  console.log(`  Target   : ${path.relative(process.cwd(), resolvedTarget)}`);
  console.log(`  Reference: ${path.relative(process.cwd(), resolvedRef)}`);

  const targetContent = fs.readFileSync(resolvedTarget, 'utf8');
  const refContent = fs.readFileSync(resolvedRef, 'utf8');

  const targetHeadings = extractHeadings(targetContent);
  const refHeadings = extractHeadings(refContent);

  console.log(`\n--- Heading Analysis ---`);
  console.log(`Target headings: ${targetHeadings.length} | Reference headings: ${refHeadings.length}`);

  const targetTitles = new Set(targetHeadings.map((h) => h.cleanTitle));
  const refTitles = new Set(refHeadings.map((h) => h.cleanTitle));

  const missingInTarget = refHeadings.filter((h) => !targetTitles.has(h.cleanTitle));
  const uniqueInTarget = targetHeadings.filter((h) => !refTitles.has(h.cleanTitle));

  if (uniqueInTarget.length > 0) {
    console.log(`\n📌 Target-Specific Headings (MUST PRESERVE per Target-as-Structure-Authority rule):`);
    for (const h of uniqueInTarget) {
      console.log(`  - H${h.level}: ${h.title} (line ${h.line})`);
    }
  }

  if (missingInTarget.length > 0) {
    console.log(`\n➕ New Reference Headings (Review for addition into Target):`);
    for (const h of missingInTarget) {
      console.log(`  + H${h.level}: ${h.title} (line ${h.line})`);
    }
  }

  // Check diff-hostile patterns
  console.log(`\n--- Diff-Hostility & Non-Deterministic Content Check ---`);
  const timestampRegex = /\b\d{4}-\d{2}-\d{2}(?:T|\s+)\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?\b/g;
  const targetTimestamps = (targetContent.match(timestampRegex) || []).length;
  const refTimestamps = (refContent.match(timestampRegex) || []).length;

  if (targetTimestamps > 0 || refTimestamps > 0) {
    console.log(`  ⚠ Notice: Found timestamps (Target: ${targetTimestamps}, Ref: ${refTimestamps}).`);
    console.log('    Recommendation: Avoid volatile date/time values in content diffs to prevent git churn.');
  } else {
    console.log('  ✔ No volatile timestamp churn detected.');
  }

  console.log('\n--- Target vs Reference Synchronization Verdict ---');
  console.log('  Rule 1: Target governs document structure, layout, and naming.');
  console.log('  Rule 2: Reference governs technical logic, instructions, and accuracy.');
  console.log('  Rule 3: Keep edits minimal and surgical.\n');
}

// --- 3. Codebase Inspector (Polyglot / Stack-Agnostic) ---

function inspectCodebase(scanDir) {
  const rootDir = path.resolve(process.cwd(), scanDir || '.');
  console.log(`[doc-tool] Inspecting codebase at: ${rootDir}\n`);

  if (!fs.existsSync(rootDir)) {
    console.error(`[ERROR] Directory does not exist: ${rootDir}`);
    process.exit(1);
  }

  const stats = {
    languages: {},
    frameworks: new Set(),
    architecture: new Set(),
    entryPoints: [],
    docsFound: [],
    apiSignals: [],
    configFiles: []
  };

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relPath = path.relative(rootDir, fullPath);

      if (['node_modules', '.git', 'dist', 'build', '.skillsync', 'backup', '.tmp'].includes(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        if (entry.name === '.agents' || entry.name === '.claude' || entry.name === '.github') {
          stats.architecture.add('Agent Skill / Ecosystem Workstation');
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        stats.languages[ext] = (stats.languages[ext] || 0) + 1;

        // Detect Docs
        if (['README.md', 'CLAUDE.md', 'AGENTS.md', 'GEMINI.md', 'DESIGN_DOC.md'].includes(entry.name) ||
            relPath.startsWith('docs/')) {
          stats.docsFound.push(relPath);
        }

        // Detect Frameworks & Entry Points
        if (entry.name === 'package.json') {
          stats.frameworks.add('Node.js / JavaScript Ecosystem');
          stats.configFiles.push(relPath);
        } else if (entry.name === 'index.html') {
          stats.architecture.add('Frontend / Web SPA');
          stats.entryPoints.push(relPath);
        } else if (entry.name === 'pom.xml' || entry.name === 'build.gradle') {
          stats.frameworks.add('Java / JVM Ecosystem');
          stats.configFiles.push(relPath);
        } else if (entry.name === 'requirements.txt' || entry.name === 'pyproject.toml') {
          stats.frameworks.add('Python Ecosystem');
          stats.configFiles.push(relPath);
        } else if (entry.name === 'go.mod') {
          stats.frameworks.add('Go Ecosystem');
          stats.configFiles.push(relPath);
        } else if (entry.name === 'Cargo.toml') {
          stats.frameworks.add('Rust Ecosystem');
          stats.configFiles.push(relPath);
        } else if (entry.name === 'composer.json') {
          stats.frameworks.add('PHP Ecosystem');
          stats.configFiles.push(relPath);
        } else if (entry.name.endsWith('.csproj') || entry.name.endsWith('.sln')) {
          stats.frameworks.add('.NET / C# Ecosystem');
          stats.configFiles.push(relPath);
        }

        // Common Server / App Entry Points
        if (['server.js', 'app.js', 'main.js', 'index.js', 'main.py', 'app.py', 'main.go'].includes(entry.name)) {
          stats.entryPoints.push(relPath);
        }

        // API Specs
        if (entry.name === 'openapi.yaml' || entry.name === 'openapi.json' || entry.name === 'swagger.json') {
          stats.apiSignals.push(relPath);
        }
      }
    }
  }

  walk(rootDir);

  // Check for Zero-build SPA signals
  if (stats.architecture.has('Frontend / Web SPA') && !fs.existsSync(path.join(rootDir, 'package.json'))) {
    stats.architecture.add('Zero-Build Native Web Application (Vanilla ES6)');
  }

  console.log('📊 Codebase Inspection Report');
  console.log('------------------------------------------------------');
  console.log(`Detected Frameworks / Runtimes:`);
  if (stats.frameworks.size === 0) {
    console.log('  - Universal / Polyglot / Custom Scripting');
  } else {
    for (const fw of stats.frameworks) console.log(`  - ${fw}`);
  }

  console.log(`\nArchitectural Styles:`);
  for (const arc of stats.architecture) console.log(`  - ${arc}`);

  console.log(`\nEntry Points (${stats.entryPoints.length}):`);
  for (const ep of stats.entryPoints.slice(0, 10)) console.log(`  - ${ep}`);

  console.log(`\nConfiguration Files:`);
  for (const cf of stats.configFiles.slice(0, 10)) console.log(`  - ${cf}`);

  console.log(`\nExisting Documentation (${stats.docsFound.length}):`);
  for (const doc of stats.docsFound.slice(0, 10)) console.log(`  - ${doc}`);

  if (stats.apiSignals.length > 0) {
    console.log(`\nAPI Specifications:`);
    for (const api of stats.apiSignals) console.log(`  - ${api}`);
  }

  console.log('\nTop File Extensions:');
  const sortedExts = Object.entries(stats.languages).sort((a, b) => b[1] - a[1]).slice(0, 8);
  for (const [ext, count] of sortedExts) {
    console.log(`  ${(ext || '<no-ext>').padEnd(10)}: ${count} files`);
  }
  console.log('------------------------------------------------------\n');
}

// --- CLI Entrypoint ---

const args = process.argv.slice(2);
const command = args[0] || 'help';

switch (command) {
  case 'validate':
    runValidate(args[1]);
    break;
  case 'audit-sync':
    runAuditSync(args[1], args[2]);
    break;
  case 'inspect-codebase':
    inspectCodebase(args[1]);
    break;
  case 'help':
  default:
    console.log(`
Documentation & Synchronization Tool (SkillSyncPro)
Usage:
  node doc-tool.js validate [dir-or-file]          Check markdown links, frontmatter & structure
  node doc-tool.js audit-sync <target> <reference> Compare heading trees & sync compatibility
  node doc-tool.js inspect-codebase [dir]          Auto-detect tech stacks, entry points & docs
  node doc-tool.js help                            Display this help message
`);
    break;
}
