import "server-only";
import mongoose from "mongoose";
import { dbConnect } from "@/service/mongo";
import { Enrollment } from "@/model/enrollment-model";
import { Module } from "@/model/module.model";
import { Watch } from "@/model/watch-model";
import { Lesson } from "@/model/lesson.model";
import { Quiz } from "@/model/quizv2-model";
import { Attempt } from "@/model/attemptv2-model";

export type ProgressStatus =
  | "not-started"
  | "in-progress"
  | "near-completion"
  | "completed";

/** Privacy-limited student progress row (FR-008) — no email/phone. */
export interface StudentProgressRow {
  studentId: string;
  name: string;
  enrollmentDate: string;
  progressPercent: number;
  lastActivityDate: string | null;
  currentModule?: string;
  currentLesson?: string;
  quizAverage?: number | null;
  status: ProgressStatus;
}

export interface StudentProgressAggregates {
  avgProgress: number;
  notStarted: number;
  inProgress: number;
  nearCompletion: number;
  completed: number;
}

export interface StudentProgressQuery {
  courseId: string;
  page?: number;
  pageSize?: number;
  status?: ProgressStatus | string;
  sortBy?: "name" | "progress" | "lastActivity" | "enrollmentDate";
  sortOrder?: "asc" | "desc";
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

function deriveStatus(progressPercent: number): ProgressStatus {
  if (progressPercent <= 0) return "not-started";
  if (progressPercent >= 100) return "completed";
  if (progressPercent >= 80) return "near-completion";
  return "in-progress";
}

/**
 * Build lesson/module maps for a course (for progress % and current position).
 */
async function getCourseLessonContext(courseId: string): Promise<{
  lessonIds: mongoose.Types.ObjectId[];
  moduleIds: mongoose.Types.ObjectId[];
  lessonToModule: Map<string, { moduleId: string; moduleTitle: string }>;
  lessonTitles: Map<string, string>;
  totalLessons: number;
}> {
  const modules = await Module.find({ course: toObjectId(courseId) })
    .select("_id title lessonIds")
    .lean();

  const lessonToModule = new Map<
    string,
    { moduleId: string; moduleTitle: string }
  >();
  const moduleIds: mongoose.Types.ObjectId[] = [];
  const lessonIds: mongoose.Types.ObjectId[] = [];

  for (const mod of modules) {
    moduleIds.push(mod._id);
    const lessonList = mod.lessonIds || [];
    for (const lid of lessonList) {
      const id = lid.toString();
      lessonIds.push(lid);
      lessonToModule.set(id, {
        moduleId: mod._id.toString(),
        moduleTitle: mod.title || "Module",
      });
    }
  }

  const lessons = await Lesson.find({ _id: { $in: lessonIds } })
    .select("_id title")
    .lean();
  const lessonTitles = new Map(
    lessons.map((l) => [l._id.toString(), l.title || "Lesson"])
  );

  return {
    lessonIds,
    moduleIds,
    lessonToModule,
    lessonTitles,
    totalLessons: lessonIds.length,
  };
}

/**
 * Privacy-safe student progress list for one course.
 * Projects only name (first+last), enrollment date, progress, last activity,
 * current module/lesson, quiz average, and status — never email/phone (FR-008).
 */
export async function getCourseStudentProgress(
  query: StudentProgressQuery
): Promise<{
  courseId: string;
  students: StudentProgressRow[];
  pagination: { page: number; pageSize: number; total: number };
  aggregates: StudentProgressAggregates;
}> {
  await dbConnect();

  const courseId = query.courseId;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const sortBy = query.sortBy ?? "lastActivity";
  const sortOrder = query.sortOrder === "asc" ? 1 : -1;

  const ctx = await getCourseLessonContext(courseId);
  const courseOid = toObjectId(courseId);

  const enrollments = await Enrollment.aggregate([
    { $match: { course: courseOid } },
    {
      $lookup: {
        from: "users",
        localField: "student",
        foreignField: "_id",
        as: "studentDoc",
      },
    },
    { $unwind: "$studentDoc" },
    {
      $project: {
        studentId: "$student",
        enrollmentDate: "$enrollment_date",
        enrollmentStatus: "$status",
        // FR-008: name only — never email, phone, or other contact fields
        firstName: "$studentDoc.firstName",
        lastName: "$studentDoc.lastName",
      },
    },
  ]);

  const studentIds = enrollments.map(
    (e: { studentId: mongoose.Types.ObjectId }) => e.studentId
  );

  const [watchStats, quizAvgs] = await Promise.all([
    ctx.lessonIds.length === 0 || studentIds.length === 0
      ? Promise.resolve([])
      : Watch.aggregate([
          {
            $match: {
              user: { $in: studentIds },
              lesson: { $in: ctx.lessonIds },
            },
          },
          { $sort: { modified_at: -1 } },
          {
            $group: {
              _id: "$user",
              completedLessons: {
                $addToSet: {
                  $cond: [
                    { $eq: ["$state", "completed"] },
                    "$lesson",
                    "$$REMOVE",
                  ],
                },
              },
              lastActivity: { $first: "$modified_at" },
              lastLesson: { $first: "$lesson" },
              lastModule: { $first: "$module" },
            },
          },
        ]),
    studentIds.length === 0
      ? Promise.resolve([])
      : Attempt.aggregate([
          {
            $match: {
              studentId: { $in: studentIds },
              status: { $in: ["submitted", "pending_grading"] },
            },
          },
          {
            $lookup: {
              from: "quizzes",
              localField: "quizId",
              foreignField: "_id",
              as: "quiz",
            },
          },
          { $unwind: "$quiz" },
          { $match: { "quiz.courseId": courseOid } },
          {
            $group: {
              _id: "$studentId",
              quizAverage: { $avg: "$scorePercent" },
            },
          },
        ]),
  ]);

  const watchMap = new Map(
    (
      watchStats as Array<{
        _id: mongoose.Types.ObjectId;
        completedLessons: mongoose.Types.ObjectId[];
        lastActivity: Date;
        lastLesson?: mongoose.Types.ObjectId;
        lastModule?: mongoose.Types.ObjectId;
      }>
    ).map((w) => [w._id.toString(), w])
  );
  const quizMap = new Map(
    (
      quizAvgs as Array<{ _id: mongoose.Types.ObjectId; quizAverage: number }>
    ).map((q) => [q._id.toString(), q.quizAverage])
  );

  // Module titles for current module fallback
  const moduleTitleById = new Map<string, string>();
  for (const [, info] of ctx.lessonToModule) {
    moduleTitleById.set(info.moduleId, info.moduleTitle);
  }

  let rows: StudentProgressRow[] = enrollments.map(
    (e: {
      studentId: mongoose.Types.ObjectId;
      enrollmentDate: Date;
      enrollmentStatus: string;
      firstName?: string;
      lastName?: string;
    }) => {
      const sid = e.studentId.toString();
      const watch = watchMap.get(sid);
      const completedCount = watch?.completedLessons?.length ?? 0;
      let progressPercent =
        ctx.totalLessons > 0
          ? Math.round((completedCount / ctx.totalLessons) * 100)
          : e.enrollmentStatus === "completed"
            ? 100
            : e.enrollmentStatus === "in-progress"
              ? 50
              : 0;

      if (e.enrollmentStatus === "completed") {
        progressPercent = Math.max(progressPercent, 100);
      }

      progressPercent = Math.min(100, Math.max(0, progressPercent));
      const status = deriveStatus(progressPercent);

      let currentModule: string | undefined;
      let currentLesson: string | undefined;
      if (watch?.lastLesson) {
        const lid = watch.lastLesson.toString();
        currentLesson = ctx.lessonTitles.get(lid);
        const modInfo = ctx.lessonToModule.get(lid);
        currentModule = modInfo?.moduleTitle;
      } else if (watch?.lastModule) {
        currentModule = moduleTitleById.get(watch.lastModule.toString());
      }

      const quizAverage = quizMap.has(sid)
        ? Math.round((quizMap.get(sid) as number) * 10) / 10
        : null;

      return {
        studentId: sid,
        name: `${e.firstName || ""} ${e.lastName || ""}`.trim() || "Student",
        enrollmentDate: new Date(e.enrollmentDate).toISOString(),
        progressPercent,
        lastActivityDate: watch?.lastActivity
          ? new Date(watch.lastActivity).toISOString()
          : null,
        currentModule,
        currentLesson,
        quizAverage,
        status,
      };
    }
  );

  // Aggregates over full set (before status filter / pagination)
  const aggregates: StudentProgressAggregates = {
    avgProgress:
      rows.length > 0
        ? Math.round(
            (rows.reduce((s, r) => s + r.progressPercent, 0) / rows.length) * 10
          ) / 10
        : 0,
    notStarted: rows.filter((r) => r.status === "not-started").length,
    inProgress: rows.filter((r) => r.status === "in-progress").length,
    nearCompletion: rows.filter((r) => r.status === "near-completion").length,
    completed: rows.filter((r) => r.status === "completed").length,
  };

  if (query.status) {
    rows = rows.filter((r) => r.status === query.status);
  }

  rows.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "progress":
        cmp = a.progressPercent - b.progressPercent;
        break;
      case "enrollmentDate":
        cmp =
          new Date(a.enrollmentDate).getTime() -
          new Date(b.enrollmentDate).getTime();
        break;
      case "lastActivity":
      default: {
        const at = a.lastActivityDate
          ? new Date(a.lastActivityDate).getTime()
          : 0;
        const bt = b.lastActivityDate
          ? new Date(b.lastActivityDate).getTime()
          : 0;
        cmp = at - bt;
        break;
      }
    }
    return cmp * sortOrder;
  });

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const students = rows.slice(start, start + pageSize);

  return {
    courseId,
    students,
    pagination: { page, pageSize, total },
    aggregates,
  };
}
