# MongoDB Logical ERD

Publication-quality logical ERD reverse-engineered from **all 22 Mongoose models** in `model/`.

## Artifacts

| File | Description |
|------|-------------|
| `ERD.png` | Raster **6200×4400 px**, 300 dpi |
| `ERD.svg` | Vector source |
| `ERD.pdf` | Printable PDF |
| `ERD.mmd` | Mermaid ER diagram |
| `ERD.puml` | PlantUML entity diagram |
| `ERD.drawio` | diagrams.net XML |
| `ERD_SYNTHESIS.md` | Collection / relationship inventory |

## Regeneration

```powershell
python scripts\generate_erd_diagram.py
```

## Notation

- **PK** `_id` · **UK** unique index · **FK** ObjectId reference · **EMB** embedded subdocument · **ARR** array
- Crow’s Foot cardinalities: `1`, `N`, `0..1`
- Relationships only from `ref`, unique compound indexes, and verified `populate()` paths
- Inferred (ObjectId without `ref`): `Module.course` → Course; `Attempt.answers[].questionId` → Question
