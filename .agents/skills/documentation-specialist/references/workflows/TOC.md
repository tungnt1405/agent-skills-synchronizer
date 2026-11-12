# Workflow Navigation

Quick reference to find the right workflow for your task.

## Primary Workflows

| Intent | Workflow | Tokens | Description |
|:---|:---|:---|:---|
| **Create new docs** | [greenfield-workflow.md](greenfield-workflow.md) | ~350 | Template-based creation (SRS, PRD, OpenAPI, Skill Spec) |
| **Design / SDD / architecture** | [design-workflow.md](design-workflow.md) | ~400 | arc42 DESIGN_DOC.md or C4 architecture.md |
| **Document code (Brownfield)** | [brownfield-workflow.md](brownfield-workflow.md) | ~400 | Universal reverse-engineering from any codebase |
| **Sync & Reconcile** | [sync-workflow.md](sync-workflow.md) | ~380 | Audit & synchronize Target vs Reference docs |
| **Review / Audit docs** | [audit-workflow.md](audit-workflow.md) | ~350 | Audit completeness, drift, and link validity |
| **Change format** | [convert-workflow.md](convert-workflow.md) | ~250 | MD to DOCX, PDF, HTML |
| **Create visuals** | [diagram-workflow.md](diagram-workflow.md) | ~350 | Mermaid (C4, sequence, ER) & UI wireframes |

## Specialized Workflows

| Intent | Workflow | Description |
|:---|:---|:---|
| **User documentation** | [user-docs-workflow.md](user-docs-workflow.md) | Manuals, how-tos, knowledge bases |
| **Developer tutorials** | [tutorial-workflow.md](tutorial-workflow.md) | API guides, CLI walkthroughs |
| **Operational docs** | [runbook-workflow.md](runbook-workflow.md) | Runbooks, incident procedures |

## Sub-Guides (Load on demand)

### Greenfield Guides
| Document | Guide | Description |
|:---|:---|:---|
| **SRS** | [greenfield/srs-guide.md](greenfield/srs-guide.md) | Software Requirements Specification |
| **PRD** | [greenfield/prd-guide.md](greenfield/prd-guide.md) | Product Requirements Document |
| **OpenAPI** | [greenfield/openapi-guide.md](greenfield/openapi-guide.md) | REST API contract design |
| **Advanced** | [greenfield/advanced.md](greenfield/advanced.md) | Complex domain modeling |

### Brownfield Guides
| Stack / Architecture | Guide | Description |
|:---|:---|:---|
| **Universal / Polyglot** | [brownfield/universal-guide.md](brownfield/universal-guide.md) | Stack-agnostic 6-step heuristic |
| **Node.js / SPA / Zero-Build** | [brownfield/nodejs-spa-guide.md](brownfield/nodejs-spa-guide.md) | Express, Fastify, Vanilla JS SPA, CLI |
| **Spring Boot / Java** | [brownfield/springboot-guide.md](brownfield/springboot-guide.md) | Spring controllers, JPA entities |
| **FastAPI / Python** | [brownfield/fastapi-guide.md](brownfield/fastapi-guide.md) | FastAPI routes, Pydantic models |

---

**PDA Principle**: Load only the workflow and sub-guide needed for your current task.
