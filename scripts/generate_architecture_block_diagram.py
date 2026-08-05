#!/usr/bin/env python3
"""
IEEE-style Software Architecture Block Diagram for LMSV2.
Evidence-only blocks from verified source paths (no invented modules).

Outputs under docs/architecture/:
  architecture-block.svg | .png | .pdf
"""

from __future__ import annotations

import os
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "docs" / "architecture"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 5600, 3600
MARGIN = 100
FG = "#000000"
BG = "#FFFFFF"
HDR = "#E8E8E8"
LAYER = "#F4F4F4"


def esc(t: str) -> str:
    return (
        str(t)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


# ---------------------------------------------------------------------------
# Layout: horizontal bands (layers). Blocks verified against source tree.
# ---------------------------------------------------------------------------

# Layer: (label, y, height, blocks[(title, lines)])
LAYERS = [
    (
        "ACTORS",
        140,
        160,
        False,  # no band fill for actors row
        [
            ("Student", ["Browser client", "Role: student"]),
            ("Instructor", ["Browser client", "Role: instructor"]),
            ("Administrator", ["Browser client", "Role: admin"]),
        ],
    ),
    (
        "L1  PRESENTATION LAYER  —  app/[locale]",
        340,
        420,
        True,
        [
            (
                "Student UI",
                [
                    "app/[locale]/(main)",
                    "courses · lessons · quizzes",
                    "account · checkout/mock",
                    "enroll-success · categories",
                ],
            ),
            (
                "Instructor UI",
                [
                    "app/[locale]/dashboard",
                    "courses · modules · lessons",
                    "quizzes · grading · lives",
                    "analytics · tutor-analytics",
                ],
            ),
            (
                "Admin UI",
                [
                    "app/[locale]/admin",
                    "users · courses · categories",
                    "enrollments · payments · reviews",
                    "analytics · quiz-settings · tutor-settings",
                ],
            ),
            (
                "i18n Shell",
                [
                    "i18n/routing.js",
                    "next-intl",
                    "locales: en · ar",
                    "messages/en.json · ar.json",
                ],
            ),
        ],
    ),
    (
        "L2  APPLICATION / EDGE LAYER",
        800,
        420,
        True,
        [
            (
                "Edge Middleware",
                [
                    "middleware.js",
                    "auth-edge.js session",
                    "RBAC /admin · /dashboard",
                    "security-headers.js",
                ],
            ),
            (
                "Server Actions",
                [
                    "app/actions/*",
                    "course · module · lesson",
                    "quizv2 · enrollment · review",
                    "admin · account · admin-setup",
                ],
            ),
            (
                "API Route Handlers",
                [
                    "app/api/*",
                    "auth · register · me · upload",
                    "tutor · quiz-generation",
                    "analytics · payments · certificates",
                    "videos · lesson-watch · lesson-images",
                ],
            ),
            (
                "Authentication Module",
                [
                    "auth.js · auth.config.js",
                    "NextAuth v5 Credentials",
                    "JWT session · bcryptjs",
                    "app/api/auth/[...nextauth]",
                ],
            ),
        ],
    ),
    (
        "L3  CROSS-CUTTING CONCERNS  —  lib/",
        1260,
        220,
        True,
        [
            (
                "Authorization & RBAC",
                ["authorization.js", "permissions.js", "auth-helpers.js", "auth-redirect.js"],
            ),
            (
                "Validation & Security",
                ["validations.js · Zod", "rate-limit.js", "security-headers.js", "sanitize-html.js"],
            ),
            (
                "Shared Utilities",
                ["constants.js", "logger.js", "errors.js", "action-wrapper.js", "routes.js"],
            ),
        ],
    ),
    (
        "L4  BUSINESS SERVICES  —  service/",
        1520,
        480,
        True,
        [
            (
                "AI Quiz Pipeline",
                [
                    "generation-orchestrator.js",
                    "quiz-generator.js",
                    "mcq-validator.js",
                    "docx-extractor.js",
                    "docx-validator.js",
                ],
            ),
            (
                "AI RAG Tutor Pipeline",
                [
                    "ai-tutor.js",
                    "lecture-embedder.js",
                    "vector-store.js",
                    "Chroma client",
                    "Gemini embed + generate",
                ],
            ),
            (
                "Analytics Services",
                [
                    "analytics/admin-analytics.service.ts",
                    "analytics/instructor-analytics.service.ts",
                    "analytics/export.service.ts",
                    "analytics/projection.service.ts",
                    "anomaly-detection · dashboard-preference",
                ],
            ),
            (
                "Persistence Gateway",
                [
                    "mongo.js",
                    "mongoose.connect cache",
                    "optional transactions",
                ],
            ),
        ],
    ),
    (
        "L5  DATA ACCESS LAYER  —  queries/ · model/",
        2040,
        360,
        True,
        [
            (
                "Query Modules",
                [
                    "queries/courses · users · lessons",
                    "enrollments · payments · quizv2",
                    "quiz-generation · tutor-interactions",
                    "queries/analytics/* aggregations",
                    "admin · reports · testimonials",
                ],
            ),
            (
                "Mongoose Models (22)",
                [
                    "User · Course · Module · Lesson · Category",
                    "Enrollment · Payment · Watch · Report",
                    "Quiz · Question · Attempt · Assessment",
                    "GenerationJob · TutorInteraction · …",
                    "model/*.js",
                ],
            ),
        ],
    ),
    (
        "L6  PERSISTENCE & EXTERNAL SYSTEMS",
        2440,
        360,
        True,
        [
            (
                "MongoDB",
                ["Primary document store", "MONGODB_CONNECTION_STRING", "via service/mongo.js"],
            ),
            (
                "Local Filesystem",
                ["uploads/videos", "uploads/lessons", "uploads/lesson-images", "public/uploads"],
            ),
            (
                "ChromaDB",
                ["Vector store", "lms_course_{courseId}", "CHROMA_URL · .chroma-data"],
            ),
            (
                "Google Gemini API",
                ["@google/genai", "generateContent", "embedContent", "GEMINI_API_KEY"],
            ),
            (
                "MockPay",
                ["app/api/payments/mock", "confirm · status", "Enrollment + Payment write"],
            ),
        ],
    ),
]


def place_blocks(layer_x, layer_w, blocks, y, h, pad=24):
    """Evenly distribute blocks inside a layer band."""
    n = len(blocks)
    gap = 28
    usable = layer_w - 2 * pad
    bw = (usable - gap * (n - 1)) / n
    bh = h - 70  # leave room for layer title
    by = y + 50
    placed = []
    for i, (title, lines) in enumerate(blocks):
        bx = layer_x + pad + i * (bw + gap)
        placed.append((bx, by, bw, bh, title, lines))
    return placed


def build_svg() -> str:
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
        f'<rect width="{W}" height="{H}" fill="{BG}"/>',
        f'<text x="{W/2}" y="48" text-anchor="middle" font-family="Times New Roman, Times, serif" '
        f'font-size="40" font-weight="bold" fill="{FG}">Software Architecture Block Diagram</text>',
        f'<text x="{W/2}" y="88" text-anchor="middle" font-family="Times New Roman, Times, serif" '
        f'font-size="24" fill="{FG}">LMSV2 — Modular Monolith · Layered Architecture (Next.js 15 App Router)</text>',
        f'<text x="{W/2}" y="118" text-anchor="middle" font-family="Times New Roman, Times, serif" '
        f'font-size="16" fill="{FG}">IEEE 1016 style · Blocks named from verified source paths · No invented modules</text>',
        "<defs>",
        f'<marker id="arr" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto">'
        f'<path d="M0,0 L12,5 L0,10 Z" fill="{FG}"/></marker>',
        "</defs>",
    ]

    layer_x = MARGIN
    layer_w = W - 2 * MARGIN
    band_bottoms = []

    for label, y, h, fill_band, blocks in LAYERS:
        if fill_band:
            parts.append(
                f'<rect x="{layer_x}" y="{y}" width="{layer_w}" height="{h}" '
                f'fill="{LAYER}" stroke="{FG}" stroke-width="2"/>'
            )
        else:
            parts.append(
                f'<rect x="{layer_x}" y="{y}" width="{layer_w}" height="{h}" '
                f'fill="{BG}" stroke="{FG}" stroke-width="1.5"/>'
            )
        parts.append(
            f'<text x="{layer_x + 20}" y="{y + 28}" font-family="Times New Roman, Times, serif" '
            f'font-size="18" font-weight="bold" fill="{FG}">{esc(label)}</text>'
        )

        placed = place_blocks(layer_x, layer_w, blocks, y, h)
        for bx, by, bw, bh, title, lines in placed:
            parts.append(
                f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" '
                f'fill="{BG}" stroke="{FG}" stroke-width="2"/>'
            )
            parts.append(
                f'<rect x="{bx}" y="{by}" width="{bw}" height="40" '
                f'fill="{HDR}" stroke="{FG}" stroke-width="2"/>'
            )
            parts.append(
                f'<text x="{bx + bw/2}" y="{by + 27}" text-anchor="middle" '
                f'font-family="Times New Roman, Times, serif" font-size="18" font-weight="bold" fill="{FG}">'
                f"{esc(title)}</text>"
            )
            for i, line in enumerate(lines):
                parts.append(
                    f'<text x="{bx + bw/2}" y="{by + 70 + i * 28}" text-anchor="middle" '
                    f'font-family="Times New Roman, Times, serif" font-size="15" fill="{FG}">'
                    f"{esc(line)}</text>"
                )

        band_bottoms.append(y + h)

    # Vertical control-flow arrows between consecutive layers (no crossings)
    for i in range(len(band_bottoms) - 1):
        y1 = band_bottoms[i]
        y2 = LAYERS[i + 1][1]
        mid = W / 2
        # only draw if there is a gap
        if y2 > y1 + 8:
            parts.append(
                f'<line x1="{mid}" y1="{y1 + 2}" x2="{mid}" y2="{y2 - 4}" '
                f'stroke="{FG}" stroke-width="2" marker-end="url(#arr)"/>'
            )

    # Side annotation for major flows (non-crossing, left margin notes)
    notes_x = MARGIN + 20
    notes = [
        (2800, "Request flow: Browser → middleware.js → UI / Server Actions / API Routes"),
        (2920, "Auth flow: Credentials → auth.js → User (bcrypt) → JWT"),
        (3040, "AI Quiz: DOCX → docx-* → generation-orchestrator → quiz-generator → Gemini"),
        (3160, "RAG: lecture-embedder → Gemini embed → ChromaDB → ai-tutor → Gemini generate"),
        (3280, "Excluded (no runtime wiring): Resend · Stripe SDK · OAuth providers"),
    ]
    parts.append(
        f'<rect x="{MARGIN}" y="2860" width="{layer_w}" height="360" fill="{BG}" stroke="{FG}" stroke-width="1.5"/>'
    )
    parts.append(
        f'<text x="{MARGIN + 20}" y="2895" font-family="Times New Roman, Times, serif" '
        f'font-size="20" font-weight="bold" fill="{FG}">Communication Notes (from source)</text>'
    )
    for y, text in notes:
        parts.append(
            f'<text x="{MARGIN + 30}" y="{y}" font-family="Times New Roman, Times, serif" '
            f'font-size="16" fill="{FG}">{esc(text)}</text>'
        )

    # Pattern badge
    parts.append(
        f'<text x="{W - MARGIN}" y="{H - 40}" text-anchor="end" '
        f'font-family="Times New Roman, Times, serif" font-size="15" fill="{FG}">'
        f"Pattern: Modular Monolith + Layered Architecture · Verified 2026-07-24</text>"
    )

    parts.append("</svg>")
    return "\n".join(parts)


def write_png(png_path: Path):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        import subprocess, sys

        subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
        from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    def font(size, bold=False):
        for c in (
            "C:/Windows/Fonts/timesbd.ttf" if bold else "C:/Windows/Fonts/times.ttf",
            "C:/Windows/Fonts/arial.ttf",
        ):
            if os.path.exists(c):
                try:
                    return ImageFont.truetype(c, size)
                except Exception:
                    pass
        return ImageFont.load_default()

    f_title = font(40, True)
    f_sub = font(22)
    f_layer = font(17, True)
    f_box = font(17, True)
    f_line = font(14)
    f_note = font(15)

    draw.text((W / 2, 18), "Software Architecture Block Diagram", fill=0, font=f_title, anchor="mt")
    draw.text(
        (W / 2, 68),
        "LMSV2 — Modular Monolith · Layered Architecture (Next.js 15 App Router)",
        fill=0,
        font=f_sub,
        anchor="mt",
    )
    draw.text(
        (W / 2, 100),
        "IEEE 1016 style · Blocks named from verified source paths · No invented modules",
        fill=0,
        font=f_line,
        anchor="mt",
    )

    layer_x = MARGIN
    layer_w = W - 2 * MARGIN
    band_bottoms = []

    for label, y, h, fill_band, blocks in LAYERS:
        if fill_band:
            draw.rectangle([layer_x, y, layer_x + layer_w, y + h], outline=0, width=2, fill=(244, 244, 244))
        else:
            draw.rectangle([layer_x, y, layer_x + layer_w, y + h], outline=0, width=2, fill=(255, 255, 255))
        draw.text((layer_x + 20, y + 10), label, fill=0, font=f_layer)

        for bx, by, bw, bh, title, lines in place_blocks(layer_x, layer_w, blocks, y, h):
            draw.rectangle([bx, by, bx + bw, by + bh], outline=0, width=2, fill=(255, 255, 255))
            draw.rectangle([bx, by, bx + bw, by + 40], outline=0, width=2, fill=(232, 232, 232))
            draw.text((bx + bw / 2, by + 20), title, fill=0, font=f_box, anchor="mm")
            for i, line in enumerate(lines):
                draw.text((bx + bw / 2, by + 62 + i * 28), line, fill=0, font=f_line, anchor="mm")

        band_bottoms.append(y + h)

    for i in range(len(band_bottoms) - 1):
        y1 = band_bottoms[i]
        y2 = LAYERS[i + 1][1]
        if y2 > y1 + 8:
            mid = W / 2
            draw.line([(mid, y1 + 2), (mid, y2 - 8)], fill=0, width=3)
            draw.polygon([(mid, y2 - 2), (mid - 8, y2 - 14), (mid + 8, y2 - 14)], fill=0)

    draw.rectangle([MARGIN, 2860, MARGIN + layer_w, 3220], outline=0, width=2, fill=(255, 255, 255))
    draw.text((MARGIN + 20, 2875), "Communication Notes (from source)", fill=0, font=f_layer)
    for i, text in enumerate(
        [
            "Request flow: Browser → middleware.js → UI / Server Actions / API Routes",
            "Auth flow: Credentials → auth.js → User (bcrypt) → JWT",
            "AI Quiz: DOCX → docx-* → generation-orchestrator → quiz-generator → Gemini",
            "RAG: lecture-embedder → Gemini embed → ChromaDB → ai-tutor → Gemini generate",
            "Excluded (no runtime wiring): Resend · Stripe SDK · OAuth providers",
        ]
    ):
        draw.text((MARGIN + 30, 2920 + i * 40), text, fill=0, font=f_note)

    draw.text(
        (W - MARGIN, H - 40),
        "Pattern: Modular Monolith + Layered Architecture · Verified 2026-07-24",
        fill=0,
        font=f_line,
        anchor="rb",
    )

    img.save(png_path, "PNG", dpi=(300, 300))
    print(f"Wrote {png_path} ({img.size[0]}x{img.size[1]})")


def write_pdf(png_path: Path, pdf_path: Path):
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.units import inch
    except ImportError:
        import subprocess, sys

        subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab", "-q"])
        from reportlab.pdfgen import canvas
        from reportlab.lib.units import inch

    page_w, page_h = 16.5 * inch, 10.6 * inch
    c = canvas.Canvas(str(pdf_path), pagesize=(page_w, page_h))
    c.drawImage(str(png_path), 0, 0, width=page_w, height=page_h, preserveAspectRatio=True, anchor="c")
    c.save()
    print(f"Wrote {pdf_path}")


def main():
    svg_path = OUT / "architecture-block.svg"
    png_path = OUT / "architecture-block.png"
    pdf_path = OUT / "architecture-block.pdf"
    # Also refresh primary names requested earlier
    svg_path2 = OUT / "architecture.svg"
    png_path2 = OUT / "architecture.png"
    pdf_path2 = OUT / "architecture.pdf"

    svg = build_svg()
    svg_path.write_text(svg, encoding="utf-8")
    svg_path2.write_text(svg, encoding="utf-8")
    print(f"Wrote {svg_path}")
    write_png(png_path)
    write_pdf(png_path, pdf_path)
    # copy equivalents
    write_png(png_path2)
    write_pdf(png_path2, pdf_path2)


if __name__ == "__main__":
    main()
