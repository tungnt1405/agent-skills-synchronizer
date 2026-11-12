# Target–Reference Documentation Synchronization Rules

Guidelines and invariant rules for synchronizing software documentation, specifications, and agent skills between Target Workspaces and Reference Sources within the SkillSyncPro ecosystem.

---

## 1. Core Principles

When synchronizing or reconciling documentation between a **Target** workspace and a **Benchmark Reference**:

### 1.1 Target = Source of Truth for Structure & Format
- Layout, heading hierarchy (H1, H2, H3), file naming conventions, indentation, and structural styling are strictly governed by the Target.
- **Do NOT** alter the Target's structural layout simply because Reference organizes its headings or sections differently.
- **Exception**: Reference content that introduces essential functional specifications, security advisories, or detailed checklists missing from Target should be cleanly incorporated into the Target's existing structure or appended as dedicated child sections.

### 1.2 Reference = Source of Truth for Content & Logic
- Technical correctness, algorithmic logic, updated API parameters, exact descriptions, and technical definitions are sourced from the Reference.
- Correct outdated, incomplete, or ambiguous statements in Target to match the proven logic in Reference.
- **Target Identity Preservation**:
  * The Target project's identity, branding, repository name, author metadata, and environment-specific paths are inviolable. Never overwrite Target's project name with Reference's project name.
  * When inheriting content or examples from Reference that reference Reference's own identity or repository names, adapt them to Target's equivalent naming context.

### 1.3 Mandatory Safety & Backup Gate
- No target documentation or skill file may be modified, overwritten, or created without verifying that a backup exists (e.g., in `.skillsync/backups/` or `backup/`).
- Modifications must be atomic, transactional, and reversible.

### 1.4 Smallest Correct Change (Diff-Friendliness)
- Make minimal, surgical edits.
- Do NOT globally reformat whitespace, reorder unrelated sections, or rewrite sentences just for aesthetic variation.
- Avoid non-deterministic tokens (dynamic timestamps like `Last updated: 2026-11-13 10:15`, random hashes, volatile runtime counters) that create artificial Git diff noise.

### 1.5 No Hardcoded Proprietary or Copyrighted Names in Public Documentation
- Any documentation, specifications, prompt templates, or test fixtures tracked outside `.gitignore` MUST use generic dummy mock identifiers (e.g., `TargetProject`, `ReferenceProject`, `mock-provider/dummy-model-*`).
- Never hardcode real vendor trademarks, commercial copyrights, or proprietary project names into public files pushed to repositories.

---

## 2. Multi-Agent Ecosystem Parity

Documentation and skills in this project frequently synchronize across multiple agent platforms:
- `.agents/skills/` (Antigravity CLI / Gemini CLI / Agnostic Agents)
- `.claude/skills/` (Claude Code / Anthropic CLI)
- `.github/skills/` (GitHub Copilot CLI / Actions)

### Parity Guidelines:
1. **Portable Relative Paths**: All markdown links and references must be relative and self-contained within the skill or document tree. Never use machine-specific absolute paths (`/home/user/...` or `C:\Users\...`).
2. **Standard YAML Frontmatter**: Keep frontmatter compliant with the `agentskills.io` specification:
   - `name`: Lowercase letters, numbers, and hyphens.
   - `description`: Actionable third-person trigger ("Use when...").
   - `metadata`: Author, version, and optional compatibility flags.
3. **Tool Agnosticism**: Avoid hardcoding platform-exclusive tool names into instructions. Use abstract tool descriptions (e.g., "Read file", "Execute CLI command", "Search files") or provide platform-mapped instructions.
4. **Zero-Build Scripting**: Any helper scripts accompanying documentation or skills must run on standard, built-in runtimes (pure Node.js built-ins `node:fs`, `node:path` or POSIX bash) without requiring `npm install` or compilation.

---

## 3. Synchronization Decision Matrix

| Scenario | Target State | Reference State | Resolution Strategy |
|:---|:---|:---|:---|
| **Identical Content** | Has section | Identical section | **No change**: Skip file / section. |
| **Outdated Logic in Target** | Has section with v1 specs | Has section with v2 specs | **Update logic**: Inject Reference v2 specifications while preserving Target's heading level, formatting, and surrounding structure. |
| **New Section in Reference** | Missing section | Contains new section | **Add section**: Append the new section into Target under the most logically relevant parent heading. |
| **Target-Only Custom Section** | Contains local customization | Not present in Reference | **Preserve**: Keep Target section intact. Never delete target-specific documentation unless explicitly directed by the user. |
| **Naming Conflict / Identity** | References `TargetProject` | References `ReferenceProject` | **Preserve Target Name**: Keep `TargetProject` while incorporating technical content. |
| **Timestamp / Metadata Drift** | `Updated: 2026-01-01` | `Updated: 2026-11-10` | **Normalize / Stabilize**: Remove volatile timestamps or align to release version tags instead of wall-clock time. |

---

## 4. Verification Checklist Before Concluding Sync

- [ ] Target structure and heading hierarchy preserved.
- [ ] Technical logic and accuracy brought up to Reference standard.
- [ ] Target project identity and branding untouched.
- [ ] No broken relative links introduced (verify via `node scripts/doc-tool.js validate`).
- [ ] No volatile timestamps causing unnecessary git churn.
- [ ] Backup verified prior to modification.
