import { getLoggedInUser } from "@/lib/loggedin-user";
import { hasEnrollmentForCourse } from "@/queries/enrollments";
import { getCourseQuizzes } from "@/queries/quizv2";
import { getStudentQuizStatusMap } from "@/queries/quizv2";
import { getCourseDetails } from "@/queries/courses";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Play, FileQuestion } from "lucide-react";

export default async function QuizzesPage({ params }) {
    const { id: courseId } = await params;

    const user = await getLoggedInUser();
    if (!user) {
        redirect("/login");
    }

    const course = await getCourseDetails(courseId);
    if (!course) {
        notFound();
    }

    // Check enrollment (instructor/admin can preview)
    const isInstructorOrAdmin = user.role === "admin" || user.role === "instructor";
    const isEnrolled = await hasEnrollmentForCourse(courseId, user.id);

    if (!isEnrolled && !isInstructorOrAdmin) {
        redirect(`/courses/${courseId}`);
    }

    // Get published quizzes
    const quizzes = await getCourseQuizzes(courseId, {
        forStudent: !isInstructorOrAdmin,
        includeUnpublished: isInstructorOrAdmin
    });

    // Get student's quiz status map
    const statusMap = await getStudentQuizStatusMap(courseId, user.id);

    // Group quizzes
    const courseQuizzes = quizzes.filter(q => !q.lessonId);
    const lessonQuizzes = quizzes.filter(q => q.lessonId);

    const getQuizStatus = (quiz) => {
        const status = statusMap[quiz.id] || {};
        
        if (status.status === "in_progress") {
            return { label: "In Progress", icon: Play, variant: "default", className: "bg-blue-100 text-blue-800" };
        }
        
        if (status.passed) {
            return { label: "Passed", icon: CheckCircle, variant: "default", className: "bg-emerald-100 text-emerald-800" };
        }
        
        if (status.status === "submitted") {
            return { label: "Completed", icon: Clock, variant: "secondary" };
        }
        
        return { label: "Not Started", icon: FileQuestion, variant: "outline" };
    };

    const getActionButton = (quiz) => {
        const status = statusMap[quiz.id] || {};
        
        if (status.status === "in_progress" && status.inProgressAttemptId) {
            return (
                <Link href={`/courses/${courseId}/quizzes/${quiz.id}?attemptId=${status.inProgressAttemptId}`}>
                    <Button>
                        <Play className="w-4 h-4 me-2 rtl:rotate-180" />
                        Resume
                    </Button>
                </Link>
            );
        }
        
        if (status.status === "submitted" || status.passed) {
            return (
                <Link href={`/courses/${courseId}/quizzes/${quiz.id}/result`}>
                    <Button variant="outline">
                        View Result
                    </Button>
                </Link>
            );
        }
        
        // Check max attempts
        if (quiz.maxAttempts !== null && status.attemptsUsed >= quiz.maxAttempts) {
            return (
                <Button disabled variant="outline">
                    Max Attempts Reached
                </Button>
            );
        }
        
        return (
            <Link href={`/courses/${courseId}/quizzes/${quiz.id}`}>
                <Button>
                    <Play className="w-4 h-4 me-2 rtl:rotate-180" />
                    Start
                </Button>
            </Link>
        );
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Quizzes</h1>
                <p className="text-slate-600">{course.title}</p>
            </div>

            {quizzes.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <p className="text-slate-500">No quizzes available for this course yet.</p>
                    <Link href={`/courses/${courseId}/lesson`}>
                        <Button variant="outline" className="mt-4">
                            Back to Lessons
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Course-level quizzes */}
                    {courseQuizzes.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold mb-4">Course Quizzes</h2>
                            <div className="space-y-4">
                                {courseQuizzes.map((quiz) => {
                                    const status = getQuizStatus(quiz);
                                    const StatusIcon = status.icon;
                                    return (
                                        <div key={quiz.id} className="border rounded-lg p-6 bg-white shadow-sm">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <h3 className="text-lg font-medium">{quiz.title}</h3>
                                                        <Badge variant={status.variant} className={status.className}>
                                                            <StatusIcon className="w-3 h-3 me-1" />
                                                            {status.label}
                                                        </Badge>
                                                        {quiz.required && (
                                                            <Badge variant="outline" className="text-xs">
                                                                Required
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {quiz.description && (
                                                        <p className="text-slate-600 mb-3">{quiz.description}</p>
                                                    )}
                                                    <div className="flex items-center gap-4 text-sm text-slate-500">
                                                        <span>Pass: {quiz.passPercent}%</span>
                                                        {quiz.timeLimitSec && (
                                                            <span>Time: {Math.floor(quiz.timeLimitSec / 60)} min</span>
                                                        )}
                                                        {quiz.maxAttempts !== null && (
                                                            <span>
                                                                Attempts: {statusMap[quiz.id]?.attemptsUsed || 0}/{quiz.maxAttempts}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="ms-4">
                                                    {getActionButton(quiz)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Lesson-level quizzes */}
                    {lessonQuizzes.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold mb-4">Lesson Quizzes</h2>
                            <div className="space-y-4">
                                {lessonQuizzes.map((quiz) => {
                                    const status = getQuizStatus(quiz);
                                    const StatusIcon = status.icon;
                                    return (
                                        <div key={quiz.id} className="border rounded-lg p-6 bg-white shadow-sm">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <h3 className="text-lg font-medium">{quiz.title}</h3>
                                                        <Badge variant={status.variant} className={status.className}>
                                                            <StatusIcon className="w-3 h-3 me-1" />
                                                            {status.label}
                                                        </Badge>
                                                        {quiz.required && (
                                                            <Badge variant="outline" className="text-xs">
                                                                Required
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {quiz.description && (
                                                        <p className="text-slate-600 mb-3">{quiz.description}</p>
                                                    )}
                                                    <div className="flex items-center gap-4 text-sm text-slate-500">
                                                        <span>Pass: {quiz.passPercent}%</span>
                                                        {quiz.timeLimitSec && (
                                                            <span>Time: {Math.floor(quiz.timeLimitSec / 60)} min</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="ms-4">
                                                    {getActionButton(quiz)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
