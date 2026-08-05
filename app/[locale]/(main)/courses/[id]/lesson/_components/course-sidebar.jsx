import { getTranslations } from "next-intl/server";
import { CourseProgress } from "@/components/course-progress";
import Link from "next/link";
import { DownloadCertificate } from "./download-certificate";
import { GiveReview } from "./give-review";
import { SidebarModules } from "./sidebar-modules";
import { getCourseDetails } from "@/queries/courses";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { Watch } from "@/model/watch-model";
import { getReport } from "@/queries/reports";
import { dbConnect } from "@/service/mongo";
import { getCourseQuizzes, getStudentQuizStatusMap } from "@/queries/quizv2";
import {
  getOrderedLessons,
  getUnlockedLessonIds,
  getLessonBasedProgress,
  toLessonIdString,
} from "@/lib/course-progress";

/**
 * Fetch all completed Watch records for this user + course in ONE query.
 * Returns a Set<string> of lesson IDs for O(1) lookup.
 */
async function getCompletedLessonIds(userId, courseId, modules) {
  await dbConnect();

  // Extract module IDs as plain strings (safe for Mongoose auto-cast)
  const moduleIdStrings = modules
    .map((m) => {
      const raw = m.id ?? m._id;
      if (raw == null) return null;
      if (typeof raw === "string") return raw;
      if (typeof raw.toString === "function") return raw.toString();
      return null;
    })
    .filter(Boolean);

  if (moduleIdStrings.length === 0) return new Set();

  const completedWatches = await Watch.find({
    user: userId,
    module: { $in: moduleIdStrings },
    state: "completed",
  })
    .select("lesson")
    .lean();

  const set = new Set(completedWatches.map((w) => w.lesson.toString()));

  console.log("[sidebar] completed watch lesson IDs:", [...set]);
  console.log("[sidebar] queried module IDs:", moduleIdStrings);

  return set;
}

export const CourseSidebar = async ({ courseId }) => {
  const t = await getTranslations("Lesson");
  const course = await getCourseDetails(courseId);
  const loggedinUser = await getLoggedInUser();

  const modules = course?.modules || [];

  // Completed lessons from Watch model
  const completedLessonIds = await getCompletedLessonIds(
    loggedinUser.id,
    courseId,
    modules
  );

  // Quiz data (for lesson-quiz badges, not for unlock logic)
  const [courseQuizzes, quizStatusMap] = await Promise.all([
    getCourseQuizzes(courseId, { forStudent: true, includeUnpublished: false }),
    getStudentQuizStatusMap(courseId, loggedinUser.id),
  ]);
  const lessonQuizMap = {};
  for (const quiz of courseQuizzes) {
    if (quiz.lessonId) {
      lessonQuizMap[quiz.lessonId.toString()] = quiz;
    }
  }

  // Sequential unlock + progress (uses ONLY `active` field, ignores `access`)
  const orderedLessons = getOrderedLessons(modules);
  const unlockedIds = getUnlockedLessonIds(orderedLessons, completedLessonIds);
  const { progress: totalProgress } = getLessonBasedProgress(orderedLessons, completedLessonIds);

  console.log("[sidebar] totalProgress:", totalProgress, "ordered count:", orderedLessons.length);

  // Annotate each lesson with `state` and `isLocked` for the client components
  const annotatedModules = modules.map((module) => {
    const lessons = module?.lessonIds || [];

    for (const lesson of lessons) {
      const id = toLessonIdString(lesson);

      // Mark completed
      lesson.state = completedLessonIds.has(id) ? "completed" : undefined;

      // Lock logic: draft lessons are always locked; active lessons locked by sequence
      if (lesson.active !== true) {
        lesson.isLocked = true;
      } else {
        lesson.isLocked = !unlockedIds.has(id);
      }
    }
    return module;
  });

  // Serialize for client (strip ObjectId / Buffer)
  const serializedModules = JSON.parse(JSON.stringify(annotatedModules));

  return (
    <div className="h-full min-h-0 border-e flex flex-col overflow-hidden shadow-sm bg-white">
      {/* Section 1: Course header & progress */}
      <header className="shrink-0 p-6 border-b space-y-4">
        <h1 className="font-semibold text-lg leading-tight" dir="auto">{course.title}</h1>
        <div>
          <CourseProgress variant="success" value={totalProgress} />
        </div>
      </header>

      {/* Section 2: Module & lesson navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-4">
        <SidebarModules
          courseId={courseId}
          modules={serializedModules}
          lessonQuizMap={lessonQuizMap}
          quizStatusMap={quizStatusMap}
        />
      </nav>

      {/* Section 3: Course quizzes (if any) */}
      {courseQuizzes.filter((q) => !q.lessonId).length > 0 && (
        <div className="shrink-0 px-6 pt-4 pb-2 border-t">
          <div className="text-sm font-medium text-slate-700 mb-2">{t("courseQuizzes")}</div>
          <Link
            href={`/courses/${courseId}/quizzes`}
            className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
          >
            {t("viewAllQuizzes", { n: courseQuizzes.filter((q) => !q.lessonId).length })}
          </Link>
        </div>
      )}

      {/* Section 4: Actions (review & certificate) */}
      <footer className="shrink-0 p-6 pt-4 border-t space-y-4 bg-slate-50/50">
        <GiveReview courseId={courseId} loginid={loggedinUser.id} />
        <DownloadCertificate courseId={courseId} totalProgress={totalProgress} />
      </footer>
    </div>
  );
};
