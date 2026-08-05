# LMS Architecture Diagrams

Publication-quality architecture diagrams reverse-engineered from the `LMSV2-main` codebase.

## Architectural pattern

**Modular Monolith + Layered Architecture** (Next.js 15 App Router)

## Primary deliverable (IEEE block diagram)

| File | Description |
|------|-------------|
| `architecture-block.png` | **5600×3600 px**, 300 dpi — thesis-ready layered block diagram |
| `architecture-block.svg` | Vector |
| `architecture-block.pdf` | Printable PDF |
| `architecture-block.mmd` | Mermaid source |
| `architecture-block.puml` | PlantUML source |
| `architecture-block.drawio` | diagrams.net XML |

`architecture.png` / `.svg` / `.pdf` are kept in sync with the block diagram.

## Regeneration

```powershell
python scripts\generate_architecture_block_diagram.py
```

## Evidence basis (validated on disk)

| Layer | Source |
|-------|--------|
| Presentation | `app/[locale]/(main)`, `dashboard`, `admin` + `i18n/` |
| Application | `middleware.js`, `app/actions/*`, `app/api/*`, `auth.js` |
| Cross-cutting | `lib/authorization.js`, `permissions.js`, `validations.js`, … |
| Business | `service/{generation-orchestrator,quiz-generator,ai-tutor,lecture-embedder,vector-store,analytics/*,mongo}.js` |
| Data access | `queries/*`, `model/*` (22 models) |
| Persistence / external | MongoDB, `uploads/`, ChromaDB, Gemini, MockPay |

Excluded (no runtime wiring): Resend, Stripe SDK, OAuth providers.
