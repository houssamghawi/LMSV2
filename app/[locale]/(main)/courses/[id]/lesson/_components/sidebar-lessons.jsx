"use client";
import { useTranslations } from "next-intl";
import { replaceMongoIdInArray } from "@/lib/convertData";
import { SidebarLessonItem } from "./sidebar-lesson-items";
import { AccordionContent } from "@/components/ui/accordion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, FileQuestion } from "lucide-react";

export const SidebarLessons = ({ courseId, lessons, module, lessonQuizMap = {}, quizStatusMap = {} }) => {
  const t = useTranslations("Lesson");
  const allLessons = replaceMongoIdInArray(lessons).toSorted((a, b) => a.order - b.order);

    return (
        <AccordionContent>
            <div className="flex flex-col w-full gap-3">
            {
              allLessons.map((lesson) => {
                const lessonQuiz = lessonQuizMap[lesson.id];
                const qId = lessonQuiz ? (lessonQuiz.id || lessonQuiz._id?.toString()) : null;
                const quizStatus = qId ? quizStatusMap[qId] : null;
                const quizPassed = quizStatus && quizStatus.passed;
                
                return (
                  <div key={lesson.id} className="space-y-1">
                    <SidebarLessonItem courseId={courseId} lesson={lesson} module={module}/>
                    {/* Lesson quiz link */}
                    {lessonQuiz && (
                      <Link
                        href={`/courses/${courseId}/quizzes/${lessonQuiz.id}`}
                        className="flex items-center gap-2 ms-6 text-sm text-slate-600 hover:text-slate-900"
                      >
                        {quizPassed ? (
                          <CheckCircle size={14} className="text-emerald-600" />
                        ) : (
                          <FileQuestion size={14} className="text-slate-500" />
                        )}
                        <span className={quizPassed ? "text-emerald-700" : ""}>{lessonQuiz.title}</span>
                        {lessonQuiz.required && (
                          <Badge variant="outline" className="text-xs py-0 px-1 h-4">
                            {t("required")}
                          </Badge>
                        )}
                      </Link>
                    )}
                  </div>
                );
              })
            }
            </div>
          </AccordionContent>
    )
    
}