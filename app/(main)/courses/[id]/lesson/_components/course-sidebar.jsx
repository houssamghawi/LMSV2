 
import { CourseProgress } from "@/components/course-progress";
import Link from "next/link";
import { DownloadCertificate } from "./download-certificate";
import { GiveReview } from "./give-review";
import { SidebarModules } from "./sidebar-modules";
import { getCourseDetails } from "@/queries/courses";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { Watch } from "@/model/watch-model";
import { ObjectId } from "mongoose";
import { getReport } from "@/queries/reports";
import { dbConnect } from "@/service/mongo";
import { getCourseQuizzes, getStudentQuizStatusMap } from "@/queries/quizv2";
import { getLessonQuiz } from "@/queries/quizv2";

/**
 * Fetch all completed watches for a user in a course in ONE query
 * Returns a Set of lesson IDs (as strings) for O(1) lookup
 */
async function getCompletedLessonsSet(userId, courseId, modules) {
  await dbConnect();
  
  // Get all module IDs from the course
  const moduleIds = modules.map(m => m._id);
  
  // Single query to get all completed watches for this user in these modules
  const completedWatches = await Watch.find({
    user: userId,
    module: { $in: moduleIds },
    state: 'completed'
  }).select('lesson').lean();
  
  // Build Set of completed lesson IDs for O(1) lookup
  return new Set(completedWatches.map(w => w.lesson.toString()));
}

export const CourseSidebar = async ({courseId}) => {

  const course = await getCourseDetails(courseId);
  const loggedinUser = await getLoggedInUser();

  const report = await getReport({ course:courseId, student: loggedinUser.id  })

  const totalCompletedModules = report?.totalCompletedModules ? report?.totalCompletedModules.length : 0;

  const totalModules = course?.modules ? course.modules.length : 0;

  const totalProgress = (totalModules > 0) ? (totalCompletedModules/totalModules) * 100 : 0;

  // PERFORMANCE FIX: Fetch all completed lessons in ONE query instead of N+1
  const completedLessonsSet = await getCompletedLessonsSet(
    loggedinUser.id, 
    courseId, 
    course?.modules || []
  );

  // Fetch quizzes and quiz status
  const [courseQuizzes, quizStatusMap] = await Promise.all([
    getCourseQuizzes(courseId, { forStudent: true, includeUnpublished: false }),
    getStudentQuizStatusMap(courseId, loggedinUser.id)
  ]);

  // Get lesson quizzes map
  const lessonQuizMap = {};
  for (const quiz of courseQuizzes) {
    if (quiz.lessonId) {
      lessonQuizMap[quiz.lessonId.toString()] = quiz;
    }
  }

  // Mark lessons as completed using the Set (O(1) lookup per lesson)
  const updatedModules = course?.modules.map((module) => {
    const lessons = module?.lessonIds || [];

    const updatedLessons = lessons.map((lesson) => {
      const lessonId = lesson._id.toString();
      const watchCompleted = completedLessonsSet.has(lessonId);
      
      // Check if lesson has required quiz
      const lessonQuiz = lessonQuizMap[lessonId];
      let allRequiredPassed = true;
      if (lessonQuiz && lessonQuiz.required) {
        const qId = lessonQuiz.id || lessonQuiz._id?.toString();
        const status = quizStatusMap[qId];
        allRequiredPassed = status && status.passed && !status.pendingManual;
      }

      // Lesson is completed when watch is completed AND required quiz passed (if any)
      if (watchCompleted && allRequiredPassed) {
        lesson.state = 'completed';
      }
      return lesson;
    });
    
    return module; 
  }) || [];

  const updatedallModules = updatedModules ? sanitizeData(updatedModules) : [];


  // Sanitize function for handle ObjectID and Buffer
function sanitizeData(data) {
  // Handle null/undefined
  if (!data || data === undefined || data === null) {
    return null;
  }
  
  try {
    const stringified = JSON.stringify(data, (key, value) => {
      if (value instanceof ObjectId) {
          return value.toString();
      }
      if (Buffer.isBuffer(value)) {
        return value.toString("base64");
      }
      return value;
    });
    
    return JSON.parse(stringified);
  } catch (error) {
    console.error('Error sanitizing data:', error);
    return null;
  }
}

  return (
    <>
      <div className="h-full border-r flex flex-col overflow-y-auto shadow-sm">
        <div className="p-8 flex flex-col border-b">
          <h1 className="font-semibold">{course.title}</h1>
          {/* Check purchase */}
          {
            <div className="mt-10">
              <CourseProgress variant="success" value={totalProgress} />
            </div>
          }
        </div> 
        
        <SidebarModules
          courseId={courseId}
          modules={updatedallModules}
          lessonQuizMap={lessonQuizMap}
          quizStatusMap={quizStatusMap}
        />

        {/* Course-level quizzes section */}
        {courseQuizzes.filter(q => !q.lessonId).length > 0 && (
          <div className="w-full px-6 pt-8 border-t">
            <div className="text-sm font-medium text-slate-700 mb-2">Course Quizzes</div>
            <Link
              href={`/courses/${courseId}/quizzes`}
              className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
            >
              View all quizzes ({courseQuizzes.filter(q => !q.lessonId).length})
            </Link>
          </div>
        )}

        <div className="w-full px-6 mb-10">
        <GiveReview courseId={courseId} loginid={loggedinUser.id} /> 
        <DownloadCertificate courseId={courseId} totalProgress={totalProgress}  />
        </div> 



      </div>
      
    </>
  );
};
