# Professional Voice and Technical Style Guide

---
TOKEN_BUDGET: 280
TIER: 1
LOAD_TRIGGER: Every document this skill writes or audits
DEPENDENCIES: SKILL.md
---

## Technical Voice Principles

All documentation produced by this skill adheres to a clean, authoritative, evidence-based technical voice.

### Style Standards

| Style Profile | Default | When to Use | Key Characteristics |
|:---|:---:|:---|:---|
| **STE100** / **Standard Technical (Concise)** | **Yes** | All system architecture, specs, runbooks, and APIs | Simplified Technical English: active voice, imperative steps, short sentences, zero fluff. |
| **google-docs-style** / **Developer Docs** | Optional | User manuals, tutorials, getting started guides | Addressed to developer/operator ("you"), conversational yet precise, code font for paths. |

---

## Universal Style Rules

1. **Active Voice & Imperative Verbs**:
   - Write: "Run the migration script before starting the server."
   - Avoid: "The migration script should be run before the server is started."
2. **Clear Sentence Length**:
   - Instructional sentences: 20 words or fewer.
   - Conceptual / architectural sentences: 25 words or fewer.
3. **Punctuation & Clean Syntax**:
   - Avoid em dash (`—`) or `--` as punctuation. Use periods, commas, or parentheses.
   - Avoid dangling pronouns at the start of sentences ("This is why...", "That means..."). Instead, name the exact subject.
   - Do not begin sentences with conversational fillers ("So", "Basically", "Obviously").
4. **Deterministic & Diff-Friendly**:
   - Avoid volatile timestamps (`2026-11-13 10:20`) in document bodies to prevent unnecessary Git diff noise during sync.
   - Anchor versions to semantic tags (e.g. `v1.2.0`, `v2.0.0`) or Git commit SHAs.
5. **No Speculation**:
   - Base all claims on actual codebase evidence (file paths, method names, configuration keys).

---

## Diagrams

Voice rules apply to prose, headings, bullet lists, and tables. Fenced code blocks (`mermaid`, `yaml`, `json`, `bash`) follow their respective language grammars.
