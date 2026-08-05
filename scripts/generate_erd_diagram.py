#!/usr/bin/env python3
"""
Generate publication-quality MongoDB Logical ERD from LMSV2 Mongoose schemas.
Outputs: docs/erd/ERD.svg, ERD.png, ERD.pdf

Evidence-only: attributes and relationships from model/*.js reverse engineering.
Style: white background, black borders, Crow's Foot, no gradients/shadows/icons.
"""

from __future__ import annotations

import os
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "docs" / "erd"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 6200, 4400
MARGIN = 60
FG = "#000000"
BG = "#FFFFFF"
HDR = "#EEEEEE"
BAND = "#F5F5F5"


# ---------------------------------------------------------------------------
# Entity definitions: (key, collection, model, attrs[(name, type, flags)], x, y, w)
# flags: PK | UK | FK | REQ | EMB | ARR | VIR
# ---------------------------------------------------------------------------

def entities():
    # Column X positions
    c1, c2, c3, c4, c5 = 80, 1280, 2480, 3680, 4880
    box_w = 1100

    return [
        # --- Col 1: User & profile/config ---
        (
            "User",
            "users",
            "User",
            [
                ("_id", "ObjectId", "PK"),
                ("firstName", "String", "REQ"),
                ("lastName", "String", "REQ"),
                ("password", "String", "REQ"),
                ("email", "String", "UK REQ"),
                ("role", "String", "REQ"),
                ("phone", "String", ""),
                ("bio", "String", ""),
                ("socialMedia", "Object", ""),
                ("profilePicture", "String", ""),
                ("designation", "String", ""),
                ("status", "String", ""),
                ("lastLogin", "Date", ""),
                ("createdAt", "Date", ""),
                ("updatedAt", "Date", ""),
            ],
            c1,
            160,
            box_w,
        ),
        (
            "UserActivityLog",
            "useractivitylogs",
            "UserActivityLog",
            [
                ("_id", "ObjectId", "PK"),
                ("user", "ObjectId→User", "FK REQ"),
                ("action", "String", "REQ"),
                ("timestamp", "Date", "REQ"),
                ("sessionDuration", "Number", ""),
                ("ipAddress", "String", ""),
                ("userAgent", "String", ""),
                ("archivedAt", "Date", ""),
            ],
            c1,
            820,
            box_w,
        ),
        (
            "DashboardPreference",
            "dashboardpreferences",
            "DashboardPreference",
            [
                ("_id", "ObjectId", "PK"),
                ("user", "ObjectId→User", "FK REQ"),
                ("role", "String", "REQ"),
                ("layout[]", "embed widget", "EMB ARR"),
                ("defaultDateRange", "String", ""),
                ("customDateRange", "embed", "EMB"),
                ("hiddenWidgets[]", "String", "ARR"),
                ("createdAt", "Date", ""),
                ("updatedAt", "Date", ""),
                ("UK(user,role)", "—", "UK"),
            ],
            c1,
            1280,
            box_w,
        ),
        (
            "AIProcessingConsent",
            "aiprocessingconsents",
            "AIProcessingConsent",
            [
                ("_id", "ObjectId", "PK"),
                ("userId", "ObjectId→User", "FK REQ"),
                ("consentVersion", "String", "REQ"),
                ("acknowledgedAt", "Date", "REQ"),
                ("userAgent", "String", ""),
                ("createdAt", "Date", ""),
                ("UK(userId,consentVersion)", "—", "UK"),
            ],
            c1,
            1800,
            box_w,
        ),
        (
            "AdminQuizConfig",
            "adminquizconfigs",
            "AdminQuizConfig",
            [
                ("_id", "ObjectId", "PK"),
                ("dailyQuotaPerInstructor", "Number", "REQ"),
                ("maxDocumentSizeBytes", "Number", "REQ"),
                ("maxQuestionsPerGeneration", "Number", "REQ"),
                ("sourceRetentionEnabled", "Boolean", "REQ"),
                ("sourceRetentionDays", "Number", ""),
                ("updatedBy", "ObjectId→User", "FK REQ"),
                ("createdAt", "Date", ""),
                ("updatedAt", "Date", ""),
            ],
            c1,
            2260,
            box_w,
        ),
        # --- Col 2: Catalog ---
        (
            "Category",
            "categories",
            "Category",
            [
                ("_id", "ObjectId", "PK"),
                ("title", "String", "REQ"),
                ("description", "String", ""),
                ("thumbnail", "String", "REQ"),
            ],
            c2,
            160,
            box_w,
        ),
        (
            "Course",
            "courses",
            "Course",
            [
                ("_id", "ObjectId", "PK"),
                ("title", "String", "REQ"),
                ("subtitle", "String", ""),
                ("description", "String", "REQ"),
                ("thumbnail", "String", ""),
                ("modules[]", "ObjectId→Module", "FK ARR"),
                ("price", "Number", "REQ"),
                ("active", "Boolean", "REQ"),
                ("category", "ObjectId→Category", "FK"),
                ("instructor", "ObjectId→User", "FK"),
                ("testimonials[]", "ObjectId→Testimonial", "FK ARR"),
                ("learning[]", "String", "ARR"),
                ("createdOn", "Date", "REQ"),
                ("modifiedOn", "Date", "REQ"),
            ],
            c2,
            460,
            box_w,
        ),
        (
            "Module",
            "modules",
            "Module",
            [
                ("_id", "ObjectId", "PK"),
                ("title", "String", "REQ"),
                ("description", "String", ""),
                ("active", "Boolean", "REQ"),
                ("slug", "String", "REQ"),
                ("course", "ObjectId→Course", "FK REQ*"),
                ("lessonIds[]", "ObjectId→Lesson", "FK ARR"),
                ("order", "Number", ""),
            ],
            c2,
            1120,
            box_w,
        ),
        (
            "Lesson",
            "lessons",
            "Lesson",
            [
                ("_id", "ObjectId", "PK"),
                ("title", "String", "REQ"),
                ("description", "String", ""),
                ("duration", "Number", "REQ"),
                ("video_url", "String", ""),
                ("videoProvider", "String", ""),
                ("videoFilename", "String", ""),
                ("videoUrl", "String", ""),
                ("videoMimeType", "String", ""),
                ("videoSize", "Number", ""),
                ("active", "Boolean", "REQ"),
                ("slug", "String", "REQ"),
                ("access", "String", "REQ"),
                ("order", "Number", "REQ"),
                ("tutorEmbeddingStatus", "String", ""),
                ("tutorContentHash", "String", ""),
                ("tutorEmbeddedAt", "Date", ""),
                ("tutorEmbeddingError", "String", ""),
                ("docxFilename", "String", ""),
                ("docxOriginalName", "String", ""),
                ("docxSize", "Number", ""),
                ("docxUploadedAt", "Date", ""),
                ("extractedHtml", "String", ""),
                ("extractedText", "String", ""),
            ],
            c2,
            1580,
            box_w,
        ),
        (
            "Testimonial",
            "testimonials",
            "Testimonial",
            [
                ("_id", "ObjectId", "PK"),
                ("content", "String", "REQ"),
                ("rating", "Number", "REQ"),
                ("courseId", "ObjectId→Course", "FK"),
                ("user", "ObjectId→User", "FK"),
            ],
            c2,
            2780,
            box_w,
        ),
        # --- Col 3: Enrollment / progress ---
        (
            "Enrollment",
            "enrollments",
            "Enrollment",
            [
                ("_id", "ObjectId", "PK"),
                ("enrollment_date", "Date", "REQ"),
                ("status", "String", "REQ"),
                ("completion_date", "Date", ""),
                ("method", "String", "REQ"),
                ("course", "ObjectId→Course", "FK REQ"),
                ("student", "ObjectId→User", "FK REQ"),
                ("payment", "ObjectId→Payment", "FK"),
                ("archivedAt", "Date", ""),
                ("UK(student,course)", "—", "UK"),
            ],
            c3,
            160,
            box_w,
        ),
        (
            "Payment",
            "payments",
            "Payment",
            [
                ("_id", "ObjectId", "PK"),
                ("user", "ObjectId→User", "FK REQ"),
                ("course", "ObjectId→Course", "FK REQ"),
                ("sessionId", "String", ""),
                ("paymentIntentId", "String", ""),
                ("customerId", "String", ""),
                ("referenceId", "String", "UK"),
                ("amount", "Number", "REQ"),
                ("currency", "String", "REQ"),
                ("status", "String", "REQ"),
                ("provider", "String", "REQ"),
                ("metadata", "Mixed", ""),
                ("refundedAmount", "Number", ""),
                ("refundReason", "String", ""),
                ("paidAt", "Date", ""),
                ("refundedAt", "Date", ""),
                ("archivedAt", "Date", ""),
                ("createdAt", "Date", ""),
                ("updatedAt", "Date", ""),
            ],
            c3,
            680,
            box_w,
        ),
        (
            "Watch",
            "watches",
            "Watch",
            [
                ("_id", "ObjectId", "PK"),
                ("state", "String", "REQ"),
                ("created_at", "Date", "REQ"),
                ("modified_at", "Date", "REQ"),
                ("lesson", "ObjectId→Lesson", "FK"),
                ("module", "ObjectId→Module", "FK"),
                ("user", "ObjectId→User", "FK"),
                ("lastTime", "Number", "REQ"),
            ],
            c3,
            1480,
            box_w,
        ),
        (
            "Report",
            "reports",
            "Report",
            [
                ("_id", "ObjectId", "PK"),
                ("totalCompletedLessons", "Array", "ARR REQ"),
                ("totalCompletedModules", "Array", "ARR REQ"),
                ("course", "ObjectId→Course", "FK"),
                ("student", "ObjectId→User", "FK"),
                ("quizAssessment", "ObjectId→Assessment", "FK"),
                ("passedQuizIds[]", "ObjectId→Quiz", "FK ARR"),
                ("latestQuizAttemptByQuiz", "Map", ""),
                ("completion_date", "Date", ""),
                ("UK(course,student)", "—", "UK"),
                ("totalCompletedModeules", "virtual", "VIR"),
            ],
            c3,
            1980,
            box_w,
        ),
        (
            "Assessment",
            "assessments",
            "Assessment",
            [
                ("_id", "ObjectId", "PK"),
                ("assessments", "Array", "ARR REQ"),
                ("otherMarks", "Number", "REQ"),
            ],
            c3,
            2680,
            box_w,
        ),
        # --- Col 4: Assessment v2 ---
        (
            "Quiz",
            "quizzes",
            "Quiz",
            [
                ("_id", "ObjectId", "PK"),
                ("courseId", "ObjectId→Course", "FK REQ"),
                ("lessonId", "ObjectId→Lesson", "FK"),
                ("title", "String", "REQ"),
                ("description", "String", ""),
                ("published", "Boolean", ""),
                ("required", "Boolean", ""),
                ("passPercent", "Number", ""),
                ("timeLimitSec", "Number", ""),
                ("maxAttempts", "Number", ""),
                ("shuffleQuestions", "Boolean", ""),
                ("shuffleOptions", "Boolean", ""),
                ("showAnswersPolicy", "String", ""),
                ("createdBy", "ObjectId→User", "FK REQ"),
                ("aiGenerated", "Boolean", ""),
                ("generationJobId", "ObjectId→GenerationJob", "FK"),
                ("createdAt", "Date", ""),
                ("updatedAt", "Date", ""),
            ],
            c4,
            160,
            box_w,
        ),
        (
            "Question",
            "questions",
            "Question",
            [
                ("_id", "ObjectId", "PK"),
                ("quizId", "ObjectId→Quiz", "FK REQ"),
                ("type", "String", "REQ"),
                ("text", "String", "REQ"),
                ("options[]", "embed {id,text}", "EMB ARR REQ"),
                ("correctOptionIds[]", "String", "ARR REQ"),
                ("modelAnswer", "String", ""),
                ("explanation", "String", ""),
                ("sourceQuote", "String", ""),
                ("difficulty", "String", ""),
                ("points", "Number", ""),
                ("order", "Number", "REQ"),
                ("createdAt", "Date", ""),
                ("updatedAt", "Date", ""),
            ],
            c4,
            900,
            box_w,
        ),
        (
            "Attempt",
            "attempts",
            "Attempt",
            [
                ("_id", "ObjectId", "PK"),
                ("quizId", "ObjectId→Quiz", "FK REQ"),
                ("studentId", "ObjectId→User", "FK REQ"),
                ("status", "String", ""),
                ("startedAt", "Date", "REQ"),
                ("expiresAt", "Date", ""),
                ("submittedAt", "Date", ""),
                ("answers[]", "embed answer", "EMB ARR"),
                ("  └ questionId", "ObjectId→Question*", "FK"),
                ("  └ gradedBy", "ObjectId→User", "FK"),
                ("score", "Number", ""),
                ("scorePercent", "Number", ""),
                ("passed", "Boolean", ""),
                ("hasShortAnswers", "Boolean", ""),
                ("pendingGradingCount", "Number", ""),
                ("finalizedAt", "Date", ""),
                ("finalizedBy", "ObjectId→User", "FK"),
                ("partial UK in_progress", "quizId+studentId", "UK"),
            ],
            c4,
            1680,
            box_w,
        ),
        (
            "GenerationJob",
            "generationjobs",
            "GenerationJob",
            [
                ("_id", "ObjectId", "PK"),
                ("userId", "ObjectId→User", "FK REQ"),
                ("courseId", "ObjectId→Course", "FK REQ"),
                ("lessonId", "ObjectId→Lesson", "FK"),
                ("targetQuizId", "ObjectId→Quiz", "FK"),
                ("jobType", "String", "REQ"),
                ("status", "String", "REQ"),
                ("failureReason", "String", ""),
                ("sourceFilename", "String", "REQ"),
                ("sourceByteSize", "Number", "REQ"),
                ("sourceContentHash", "String", ""),
                ("extractedTextLength", "Number", ""),
                ("extractionWarnings[]", "String", "ARR"),
                ("params", "embed", "EMB REQ"),
                ("aiProvider", "String", ""),
                ("aiModel", "String", ""),
                ("aiTokensInput", "Number", ""),
                ("aiTokensOutput", "Number", ""),
                ("consentVersion", "String", "REQ"),
                ("draftQuestions[]", "embed", "EMB ARR"),
                ("mcqValidationSummary", "embed", "EMB"),
                ("startedAt", "Date", ""),
                ("completedAt", "Date", ""),
            ],
            c4,
            2680,
            box_w,
        ),
        # --- Col 5: Tutor ---
        (
            "TutorConfiguration",
            "tutorconfigurations",
            "TutorConfiguration",
            [
                ("_id", "ObjectId", "PK"),
                ("courseId", "ObjectId→Course", "FK UK"),
                ("outOfContextMessage", "embed {en,ar}", "EMB"),
                ("enabled", "Boolean", ""),
                ("rateLimitPerHour", "Number", ""),
                ("relevanceThreshold", "Number", ""),
                ("maxContextChunks", "Number", ""),
                ("updatedBy", "ObjectId→User", "FK"),
                ("updatedAt", "Date", ""),
            ],
            c5,
            160,
            box_w,
        ),
        (
            "TutorInteraction",
            "tutorinteractions",
            "TutorInteraction",
            [
                ("_id", "ObjectId", "PK"),
                ("question", "String", "REQ"),
                ("response", "String", "REQ"),
                ("citation", "String", ""),
                ("contextStatus", "String", "REQ"),
                ("contextChunkIds[]", "String", "ARR"),
                ("detectedLanguage", "String", "REQ"),
                ("studentId", "ObjectId→User", "FK REQ"),
                ("courseId", "ObjectId→Course", "FK REQ"),
                ("lessonId", "ObjectId→Lesson", "FK REQ"),
                ("feedback", "String", ""),
                ("createdAt", "Date", "REQ"),
                ("metadata", "embed", "EMB"),
            ],
            c5,
            700,
            box_w,
        ),
        (
            "TutorReport",
            "tutorreports",
            "TutorReport",
            [
                ("_id", "ObjectId", "PK"),
                ("interactionId", "ObjectId→TutorInteraction", "FK REQ"),
                ("studentId", "ObjectId→User", "FK REQ"),
                ("reason", "String", "REQ"),
                ("details", "String", ""),
                ("createdAt", "Date", "REQ"),
                ("UK(interactionId,studentId)", "—", "UK"),
            ],
            c5,
            1460,
            box_w,
        ),
    ]


def entity_height(attrs):
    return 52 + 22 * len(attrs) + 8


def layout_boxes():
    boxes = {}
    for key, coll, model, attrs, x, y, w in entities():
        h = entity_height(attrs)
        boxes[key] = {
            "key": key,
            "coll": coll,
            "model": model,
            "attrs": attrs,
            "x": x,
            "y": y,
            "w": w,
            "h": h,
            "cx": x + w / 2,
            "cy": y + h / 2,
        }
    return boxes


# Relationships: (from, to, label, cardinality)
# cardinality uses crow's foot codes: "1" "N" "0..1" drawn at ends
RELS = [
    ("User", "Course", "instructor", "1", "N"),
    ("Category", "Course", "category", "1", "N"),
    ("Course", "Module", "modules[] / course", "1", "N"),
    ("Module", "Lesson", "lessonIds[]", "1", "N"),
    ("User", "Enrollment", "student", "1", "N"),
    ("Course", "Enrollment", "course", "1", "N"),
    ("Enrollment", "Payment", "payment", "0..1", "0..1"),
    ("User", "Payment", "user", "1", "N"),
    ("Course", "Payment", "course", "1", "N"),
    ("User", "Testimonial", "user", "1", "N"),
    ("Course", "Testimonial", "courseId", "1", "N"),
    ("User", "Watch", "user", "1", "N"),
    ("Lesson", "Watch", "lesson", "1", "N"),
    ("Module", "Watch", "module", "1", "N"),
    ("User", "Report", "student", "1", "N"),
    ("Course", "Report", "course", "1", "N"),
    ("Assessment", "Report", "quizAssessment", "0..1", "0..1"),
    ("Quiz", "Report", "passedQuizIds[] M:N", "N", "N"),
    ("Course", "Quiz", "courseId", "1", "N"),
    ("Lesson", "Quiz", "lessonId", "0..1", "N"),
    ("User", "Quiz", "createdBy", "1", "N"),
    ("Quiz", "Question", "quizId", "1", "N"),
    ("Quiz", "Attempt", "quizId", "1", "N"),
    ("User", "Attempt", "studentId", "1", "N"),
    ("User", "GenerationJob", "userId", "1", "N"),
    ("Course", "GenerationJob", "courseId", "1", "N"),
    ("Lesson", "GenerationJob", "lessonId", "0..1", "N"),
    ("Quiz", "GenerationJob", "targetQuizId", "0..1", "N"),
    ("GenerationJob", "Quiz", "generationJobId", "0..1", "0..1"),
    ("User", "AdminQuizConfig", "updatedBy", "1", "N"),
    ("User", "AIProcessingConsent", "userId", "1", "N"),
    ("Course", "TutorConfiguration", "courseId sparse UK", "0..1", "0..1"),
    ("User", "TutorConfiguration", "updatedBy", "1", "N"),
    ("User", "TutorInteraction", "studentId", "1", "N"),
    ("Course", "TutorInteraction", "courseId", "1", "N"),
    ("Lesson", "TutorInteraction", "lessonId", "1", "N"),
    ("TutorInteraction", "TutorReport", "interactionId", "1", "N"),
    ("User", "TutorReport", "studentId", "1", "N"),
    ("User", "UserActivityLog", "user", "1", "N"),
    ("User", "DashboardPreference", "user", "1", "N"),
]


def esc(t: str) -> str:
    return (
        str(t)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def edge_point(box, toward_x, toward_y):
    dx = toward_x - box["cx"]
    dy = toward_y - box["cy"]
    if abs(dx) * box["h"] > abs(dy) * box["w"]:
        if dx > 0:
            return box["x"] + box["w"], box["cy"]
        return box["x"], box["cy"]
    if dy > 0:
        return box["cx"], box["y"] + box["h"]
    return box["cx"], box["y"]


def crow_foot_marker(end: str, side: str) -> str:
    """Return SVG for crow's foot at connection end. side: 'start'|'end'."""
    # Simplified: use text labels near ends instead of complex geometry
    return end


def svg_entity(b) -> str:
    parts = []
    x, y, w, h = b["x"], b["y"], b["w"], b["h"]
    parts.append(
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{BG}" stroke="{FG}" stroke-width="2"/>'
    )
    # header
    parts.append(
        f'<rect x="{x}" y="{y}" width="{w}" height="48" fill="{HDR}" stroke="{FG}" stroke-width="2"/>'
    )
    parts.append(
        f'<text x="{x + w/2}" y="{y + 20}" text-anchor="middle" '
        f'font-family="Times New Roman, Times, serif" font-size="18" font-weight="bold" fill="{FG}">'
        f'{esc(b["coll"])}</text>'
    )
    parts.append(
        f'<text x="{x + w/2}" y="{y + 40}" text-anchor="middle" '
        f'font-family="Times New Roman, Times, serif" font-size="13" fill="{FG}">'
        f'Model: {esc(b["model"])}</text>'
    )
    # separator
    parts.append(
        f'<line x1="{x}" y1="{y + 48}" x2="{x + w}" y2="{y + 48}" stroke="{FG}" stroke-width="1.5"/>'
    )
    for i, (name, typ, flags) in enumerate(b["attrs"]):
        yy = y + 68 + i * 22
        flag_s = f"  [{flags}]" if flags else ""
        parts.append(
            f'<text x="{x + 12}" y="{yy}" font-family="Times New Roman, Times, serif" '
            f'font-size="13" fill="{FG}">{esc(name)} : {esc(typ)}{esc(flag_s)}</text>'
        )
    return "\n".join(parts)


def build_svg() -> str:
    boxes = layout_boxes()
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
        f'<rect width="{W}" height="{H}" fill="{BG}"/>',
        f'<text x="{W/2}" y="42" text-anchor="middle" font-family="Times New Roman, Times, serif" '
        f'font-size="36" font-weight="bold" fill="{FG}">MongoDB Logical Entity-Relationship Diagram</text>',
        f'<text x="{W/2}" y="78" text-anchor="middle" font-family="Times New Roman, Times, serif" '
        f'font-size="20" fill="{FG}">LMSV2 — Collections reverse-engineered from Mongoose schemas (model/*)</text>',
        f'<text x="{W/2}" y="108" text-anchor="middle" font-family="Times New Roman, Times, serif" '
        f'font-size="16" fill="{FG}">Crow\'s Foot notation · PK / UK / FK / EMB from actual schema definitions</text>',
        # domain band labels
    ]

    # Domain headers
    for label, x in [
        ("USER & CONFIG", 80),
        ("CATALOG", 1280),
        ("ENROLLMENT & PROGRESS", 2480),
        ("ASSESSMENT v2 & AI QUIZ", 3680),
        ("AI TUTOR", 4880),
    ]:
        parts.append(
            f'<text x="{x}" y="140" font-family="Times New Roman, Times, serif" '
            f'font-size="14" font-weight="bold" fill="{FG}">{esc(label)}</text>'
        )

    parts.append("<defs>")
    parts.append(
        f'<marker id="cf-many" markerWidth="14" markerHeight="12" refX="12" refY="6" orient="auto">'
        f'<path d="M0,0 L12,6 L0,12 M12,0 L12,12" fill="none" stroke="{FG}" stroke-width="1.5"/></marker>'
    )
    parts.append(
        f'<marker id="cf-one" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">'
        f'<path d="M8,0 L8,10" fill="none" stroke="{FG}" stroke-width="2"/></marker>'
    )
    parts.append("</defs>")

    # Draw relationships first (under boxes)
    for i, (frm, to, label, c_from, c_to) in enumerate(RELS):
        a, b = boxes[frm], boxes[to]
        x1, y1 = edge_point(a, b["cx"], b["cy"])
        x2, y2 = edge_point(b, a["cx"], a["cy"])
        # slight offset per edge to reduce perfect overlaps
        offset = ((i % 7) - 3) * 6
        mx = (x1 + x2) / 2 + offset
        my = (y1 + y2) / 2 + offset
        d = f"M {x1:.1f} {y1:.1f} L {mx:.1f} {y1:.1f} L {mx:.1f} {y2:.1f} L {x2:.1f} {y2:.1f}"
        marker = "url(#cf-many)" if c_to in ("N",) else "url(#cf-one)"
        parts.append(
            f'<path d="{d}" fill="none" stroke="{FG}" stroke-width="1.4" marker-end="{marker}"/>'
        )
        # cardinality labels
        parts.append(
            f'<text x="{x1 + (mx-x1)*0.25:.1f}" y="{y1 - 6:.1f}" text-anchor="middle" '
            f'font-family="Times New Roman, Times, serif" font-size="11" fill="{FG}">{esc(c_from)}</text>'
        )
        parts.append(
            f'<text x="{x2 - (x2-mx)*0.25:.1f}" y="{y2 - 6:.1f}" text-anchor="middle" '
            f'font-family="Times New Roman, Times, serif" font-size="11" fill="{FG}">{esc(c_to)}</text>'
        )
        parts.append(
            f'<text x="{mx:.1f}" y="{my - 8:.1f}" text-anchor="middle" '
            f'font-family="Times New Roman, Times, serif" font-size="11" fill="{FG}">{esc(label)}</text>'
        )

    for b in boxes.values():
        parts.append(svg_entity(b))

    # Legend
    lx, ly = MARGIN, H - 320
    parts.append(
        f'<rect x="{lx}" y="{ly}" width="2400" height="280" fill="{BG}" stroke="{FG}" stroke-width="1.5"/>'
    )
    parts.append(
        f'<text x="{lx + 16}" y="{ly + 28}" font-family="Times New Roman, Times, serif" '
        f'font-size="18" font-weight="bold" fill="{FG}">Legend</text>'
    )
    legend_lines = [
        "PK = Primary identifier (_id) · UK = Unique index/constraint · FK = ObjectId reference · REQ = required",
        "EMB = Embedded subdocument · ARR = Array field · VIR = Mongoose virtual",
        "Crow's Foot: 1 = one · N = many · 0..1 = zero-or-one  |  * Module.course / Attempt.answers.questionId have ObjectId without ref tag",
        "Enrollment UK(student,course) implements User↔Course many-to-many association",
        "Report.passedQuizIds[] implements Quiz↔Report many-to-many · Course.testimonials[] + Testimonial.courseId bidirectional",
        "ChromaDB chunk ids (TutorInteraction.contextChunkIds) are String[], not a Mongoose collection — omitted as entity",
        "22 collections · No invented relationships · Source: model/*.js + populate() paths in queries/ and app/",
    ]
    for i, line in enumerate(legend_lines):
        parts.append(
            f'<text x="{lx + 16}" y="{ly + 58 + i * 28}" font-family="Times New Roman, Times, serif" '
            f'font-size="14" fill="{FG}">{esc(line)}</text>'
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

    boxes = layout_boxes()
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

    f_title = font(36, True)
    f_sub = font(20)
    f_hdr = font(16, True)
    f_attr = font(12)
    f_small = font(11)
    f_band = font(13, True)

    draw.text((W / 2, 16), "MongoDB Logical Entity-Relationship Diagram", fill=0, font=f_title, anchor="mt")
    draw.text(
        (W / 2, 58),
        "LMSV2 — Collections reverse-engineered from Mongoose schemas (model/*)",
        fill=0,
        font=f_sub,
        anchor="mt",
    )
    draw.text(
        (W / 2, 90),
        "Crow's Foot notation · PK / UK / FK / EMB from actual schema definitions",
        fill=0,
        font=f_small,
        anchor="mt",
    )

    for label, x in [
        ("USER & CONFIG", 80),
        ("CATALOG", 1280),
        ("ENROLLMENT & PROGRESS", 2480),
        ("ASSESSMENT v2 & AI QUIZ", 3680),
        ("AI TUTOR", 4880),
    ]:
        draw.text((x, 120), label, fill=0, font=f_band)

    for i, (frm, to, label, c_from, c_to) in enumerate(RELS):
        a, b = boxes[frm], boxes[to]
        x1, y1 = edge_point(a, b["cx"], b["cy"])
        x2, y2 = edge_point(b, a["cx"], a["cy"])
        offset = ((i % 7) - 3) * 6
        mx = (x1 + x2) / 2 + offset
        draw.line([(x1, y1), (mx, y1), (mx, y2), (x2, y2)], fill=0, width=2)
        # simple crow's foot: three lines at many end
        if c_to == "N":
            draw.line([(x2 - 12, y2 - 6), (x2, y2), (x2 - 12, y2 + 6)], fill=0, width=2)
            draw.line([(x2 - 4, y2 - 8), (x2 - 4, y2 + 8)], fill=0, width=2)
        else:
            draw.line([(x2 - 6, y2 - 8), (x2 - 6, y2 + 8)], fill=0, width=2)
        draw.text((mx, (y1 + y2) / 2 - 8), f"{c_from}—{label}—{c_to}", fill=0, font=f_small, anchor="mm")

    for b in boxes.values():
        x, y, w, h = b["x"], b["y"], b["w"], b["h"]
        draw.rectangle([x, y, x + w, y + h], outline=0, width=2, fill=(255, 255, 255))
        draw.rectangle([x, y, x + w, y + 48], outline=0, width=2, fill=(238, 238, 238))
        draw.text((x + w / 2, y + 14), b["coll"], fill=0, font=f_hdr, anchor="mt")
        draw.text((x + w / 2, y + 34), f"Model: {b['model']}", fill=0, font=f_small, anchor="mt")
        for i, (name, typ, flags) in enumerate(b["attrs"]):
            flag_s = f"  [{flags}]" if flags else ""
            draw.text((x + 10, y + 56 + i * 22), f"{name} : {typ}{flag_s}", fill=0, font=f_attr)

    # Legend
    lx, ly = MARGIN, H - 320
    draw.rectangle([lx, ly, lx + 2400, ly + 280], outline=0, width=2, fill=(255, 255, 255))
    draw.text((lx + 16, ly + 12), "Legend", fill=0, font=f_hdr)
    for i, line in enumerate(
        [
            "PK = Primary identifier (_id) · UK = Unique · FK = ObjectId reference · REQ = required · EMB = embed · ARR = array · VIR = virtual",
            "Crow's Foot: 1 / N / 0..1  |  * Module.course and Attempt.answers.questionId are ObjectId without Mongoose ref",
            "Enrollment UK(student,course) = User↔Course M:N association · Report.passedQuizIds[] = Quiz↔Report M:N",
            "22 collections from model/* · Relationships from ref tags, unique indexes, and populate() usage · No invented entities",
        ]
    ):
        draw.text((lx + 16, ly + 50 + i * 36), line, fill=0, font=f_attr)

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

    # Wide landscape page matching aspect (~6200:4400)
    page_w, page_h = 17.0 * inch, 12.1 * inch
    c = canvas.Canvas(str(pdf_path), pagesize=(page_w, page_h))
    c.drawImage(str(png_path), 0, 0, width=page_w, height=page_h, preserveAspectRatio=True, anchor="c")
    c.save()
    print(f"Wrote {pdf_path}")


def main():
    svg_path = OUT / "ERD.svg"
    png_path = OUT / "ERD.png"
    pdf_path = OUT / "ERD.pdf"
    svg_path.write_text(build_svg(), encoding="utf-8")
    print(f"Wrote {svg_path}")
    write_png(png_path)
    write_pdf(png_path, pdf_path)


if __name__ == "__main__":
    main()
