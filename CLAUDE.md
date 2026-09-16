# SkillSyncPro — Contributor & AI Agent Guidelines

## 1. Project Overview & Architecture

**SkillSyncPro** (`sync_supperpowers_and_tais`) is a dedicated Single Page Application (SPA) Workstation for comparing, auditing differences, resolving conflicts, and synchronizing skills and configurations between **Target Workspace** and **Benchmark Reference** (unifying superpowers and tungnt-ai-skills ecosystems).

### Core Philosophy: Zero-Build Native SPA
- **Zero-Build Architecture**: Runs directly in any modern browser without bundling or compilation (no Webpack, Vite, Rollup, or Babel required).
- **Zero External Runtime Dependencies**: Both the frontend and backend tools run purely on web standards (Vanilla ES6 Modules, Semantic HTML5, Tailwind CSS via CDN, Google Material Symbols) and Node.js built-in modules (`node:http`, `node:fs/promises`, `node:path`, `node:crypto`, `node:child_process`).
- **Transactional & Safe Synchronization**: File synchronization incorporates mandatory safety backups, transactional execution with rollback capability, and complete audit trail logging.

---

## 2. Target vs Reference Synchronization Principles

When synchronizing or comparing files between two repositories:

1. **Target = Source of Truth for Structure & Format**:
   - Layout, headings, hierarchy, coding conventions, styling, and naming standards are strictly governed by the Target.
   - Do NOT modify Target structure solely because Reference organizes content differently.
2. **Reference = Source of Truth for Content & Logic**:
   - Technical accuracy, prompt instructions, functional logic, terminology, and wording updates come from Reference.
3. **Mandatory Safety Gate (Backup Before Write)**:
   - Target files must NEVER be written, created, modified, or deleted without a successful mirror backup created beforehand in `backup/`.
4. **Audit Trail Logging**:
   - Every file change or creation generates an audit report at `results/<yyyymmdd>/target/...`.
5. **Smallest Correct Change**:
   - Make minimal, surgical edits. Do not normalize whitespace globally, reorder unrelated sections, or introduce speculative abstractions.

---

## 3. Directory Layout

```text
.
├── .agents/skills/              # Agent skills (e.g., target-reference-file-sync)
├── .claude/skills/              # Claude Code skills mirror
├── .github/skills/              # GitHub Copilot / Actions skills mirror
├── assets/
│   ├── css/
│   │   └── app.css              # Custom styling, scrollbars, and color tokens
│   └── js/
│       ├── app.js               # Application bootstrap & coordinator
│       ├── modal.js             # Centralized modal manager (focus trap, ESC, ARIA)
│       ├── source-api.js        # Client API service communicating with local server
│       ├── store.js             # Centralized reactive state store & anti-XSS escapeHtml
│       └── views/
│           ├── workstation.js   # Comparator Workstation UI (dual tree, folder selector)
│           └── diff-inspector.js# Side-by-side Git Diff & Merge Inspector view
├── sources/                     # Local working directory for target & reference repositories
├── tests/
│   └── ui-smoke.test.js         # Automated end-to-end smoke & regression test suite
├── tools/
│   ├── ai-merge-engine.js       # AI-assisted diff merge prompt & response parser
│   ├── skillsync-server.js      # Pure Node.js HTTP server & filesystem comparison API
│   └── sync-executor.js         # Batch sync execution, backups, and file writes
├── index.html                   # Zero-build SPA container with 6 screens & modal dialogs
├── CLAUDE.md                    # Core project & AI guidelines (Single Source of Truth)
├── GEMINI.md                    # References @CLAUDE.md for Gemini / Antigravity
├── AGENTS.md                    # References @CLAUDE.md for multi-agent environments
├── README.md                    # Detailed application documentation & specs
└── .gitignore                   # Ignored runtime artifacts, backups, and secrets
```

---

## 4. Coding & Security Guidelines

- **Vanilla JavaScript (ES Modules)**:
  - Keep modules modular and clean.
  - Export functions and classes clearly. Do not introduce npm packages to the browser runtime.
- **Security & Anti-XSS**:
  - All user-supplied text or external file contents rendered into innerHTML MUST be sanitized using `escapeHtml()`.
  - Path inputs MUST be validated using `normalizeRelativePath()` to strictly prevent path traversal (`../`).
- **Accessibility & UX**:
  - Maintain WCAG 2.1 AA compliance: accessible color contrast, keyboard shortcuts (<kbd>Ctrl+K</kbd>, <kbd>Ctrl+Enter</kbd>, <kbd>Esc</kbd>), ARIA dialog attributes, and focus trapping within modals.
- **Safety Policy Compliance**:
  - Respect repository policies: `policy.autoCommit: false` (leave commits for user confirmation), `policy.autoTest: false`.
  - Block dangerous shell commands (`rm -rf`, `chmod -R 777`).
  - Never commit or expose sensitive files (`.env`, `*.pem`, `secrets.json`).

---

## 5. Development & Verification Commands

### Run Automated Smoke Test Suite
```bash
node tests/ui-smoke.test.js
```
*Always verify that all tests pass (100% PASS) before concluding any work.*

### Launch Local Server & Filesystem API
```bash
node tools/skillsync-server.js
# Or with custom port:
# SKILLSYNC_PORT=5000 node tools/skillsync-server.js
```
Default server endpoint: `http://localhost:4173`

### Check Syntax Integrity
```bash
node --check assets/js/app.js
node --check assets/js/store.js
node --check assets/js/modal.js
node --check assets/js/source-api.js
node --check assets/js/views/workstation.js
node --check assets/js/views/diff-inspector.js
node --check tools/skillsync-server.js
node --check tools/sync-executor.js
node --check tools/ai-merge-engine.js
```

---

## 6. Guidelines for AI Agents

1. **Protect Human Partner & Project Quality**: Do not submit half-baked changes or speculative code. Test everything.
2. **Preserve Zero-Build Philosophy**: Never introduce package managers or bundlers for the SPA client.
3. **Verify Against Smoke Tests**: Always run `node tests/ui-smoke.test.js` after touching HTML, JS, or tools.
4. **Adhere to Target-Reference Protocol**: For file synchronization tasks, strictly enforce the rules defined in `.claude/skills/target-reference-file-sync/SKILL.md`.
