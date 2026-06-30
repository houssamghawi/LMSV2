import { getLoggedInUser } from "@/lib/loggedin-user";
import { isAdmin } from "@/lib/authorization";
import { notFound } from "next/navigation";
import { Quiz } from "@/model/quizv2-model";
import { dbConnect } from "@/service/mongo";
import { replaceMongoIdInArray } from "@/lib/convertData";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function AdminQuizzesPage() {
    const user = await getLoggedInUser();
    if (!user || !isAdmin(user)) {
        notFound();
    }

    const t = await getTranslations("Admin");
    await dbConnect();
    const quizzes = await Quiz.find({})
        .populate("courseId", "title")
        .populate("lessonId", "title")
        .sort({ createdAt: -1 })
        .lean();

    const quizzesPlain = replaceMongoIdInArray(quizzes || []);

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">{t("allQuizzes")}</h1>

            {quizzesPlain.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <p className="text-slate-500">{t("noQuizzesFound")}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {quizzesPlain.map((quiz) => (
                        <div key={quiz.id} className="border rounded-lg p-6 bg-white">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-lg font-medium" dir="auto">{quiz.title}</h3>
                                        {quiz.published ? (
                                            <Badge variant="default" className="bg-emerald-100 text-emerald-800">
                                                <Eye className="w-3 h-3 me-1 rtl:rotate-180" />
                                                {t("publishedBadge")}
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">
                                                <EyeOff className="w-3 h-3 me-1 rtl:rotate-180" />
                                                {t("draft")}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-600 mb-2" dir="auto">
                                        {t("course")}: {quiz.courseId?.title || t("unknown")}
                                        {quiz.lessonId && ` • ${t("lesson")}: ${quiz.lessonId.title}`}
                                    </p>
                                    <p className="text-sm text-slate-500" dir="auto">{quiz.description}</p>
                                </div>
                                <div className="ms-4">
                                    <Link href={`/dashboard/courses/${quiz.courseId?.id || ""}/quizzes/${quiz.id}/attempts`}>
                                        <Badge variant="outline" className="cursor-pointer">
                                            {t("viewAttempts")}
                                        </Badge>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
