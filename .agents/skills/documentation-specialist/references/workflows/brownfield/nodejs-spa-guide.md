# Node.js & Web SPA Code-to-Docs Guide

---
TOKEN_BUDGET: 300
TIER: 3
LOAD_TRIGGER: CODE_TO_DOCS on Node.js, Express, Fastify, Vanilla JS SPA, or CLI tools
DEPENDENCIES: references/workflows/brownfield/universal-guide.md
---

## Overview

Extraction patterns for Node.js backends, Zero-Build SPAs, and client-side applications.

---

## Detection Signals

```bash
# Glob manifests
Glob: "package.json", "index.html", "assets/js/**/*.js", "tools/**/*.js"

# Detect Zero-Build SPA vs Bundled
If index.html loads <script type="module" src="..."> without bundle dist -> Zero-Build Native SPA
If package.json has "express" or "fastify" -> Node.js Web Server
```

---

## Extraction Heuristics

### 1. Server Architecture & API Endpoints
- **Native Node.js Server (`http.createServer`)**:
  - Search: `req.url`, `req.method`, `url.pathname` switch cases or router maps.
  - Extract route endpoints, query parameters, and JSON payloads.
- **Express / Fastify**:
  - Search: `app.get(`, `app.post(`, `fastify.route(`
  - Extract route paths, middlewares, validation schemas.

### 2. Frontend / SPA View & State Architecture
- **State Store**:
  - Search for state singletons or reactive stores (e.g., `store.js`, `createStore`, `reactive`).
  - Extract state properties, actions, mutation triggers, and persistence (e.g. `localStorage`).
- **Views & Screens**:
  - Search for view containers in `index.html` (e.g., `<main id="view-...">`) and view controllers (e.g. `assets/js/views/*.js`).
  - Document user flows between screens.

### 3. Client-Server API Bridge
- Search `source-api.js` or `api.js` or `fetch(` calls.
- Map frontend API calls to backend endpoints to create an end-to-end Sequence Diagram.

### 4. Security & Sanitization
- Search for anti-XSS sanitizers (`escapeHtml`, DOMPurify).
- Search for path traversal guards (`normalizeRelativePath`, `path.resolve` validation).
- Search for policy guards (`dangerousCommands`, `sensitiveFiles`).

---

## Recommended Document Generation

1. **System Architecture (`docs/architecture.md`)**:
   - Zero-build client structure + local server HTTP API.
   - Mermaid C4 Container Diagram illustrating browser -> HTTP server -> filesystem / agent CLI.
2. **API Specification (`openapi.yaml`)**:
   - Endpoints extracted from server routes.
3. **Software Design Document (`DESIGN_DOC.md`)**:
   - arc42 format with Component, Sequence, and Security viewpoints.
