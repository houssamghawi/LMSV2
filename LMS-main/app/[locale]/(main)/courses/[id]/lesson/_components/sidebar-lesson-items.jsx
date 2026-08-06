import { cn } from "@/lib/utils";
import { CheckCircle, Lock, PlayCircle } from "lucide-react";
import Link from "next/link";

export const SidebarLessonItem = ({ courseId, lesson, module }) => {
  const isLocked = lesson?.isLocked === true;
  const isCompleted = lesson?.state === "completed";

  const content = (
    <div className="flex items-center gap-x-2">
      {isLocked ? (
        <Lock size={16} className="text-slate-700" />
      ) : isCompleted ? (
        <CheckCircle size={16} className="text-emerald-700" />
      ) : (
        <PlayCircle size={16} className="text-slate-700" />
      )}
      <span dir="auto">{lesson.title}</span>
    </div>
  );

  if (isLocked) {
    return (
      <span
        className={cn(
          "flex items-center gap-x-2 text-slate-500 text-sm font-[500] cursor-not-allowed opacity-80"
        )}
        aria-disabled
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={`/courses/${courseId}/lesson?name=${lesson.slug}&module=${module}`}
      className={cn(
        "flex items-center gap-x-2 text-slate-500 text-sm font-[500] transition-all hover:text-slate-600",
        isCompleted && "text-emerald-700 hover:text-emerald-700"
      )}
    >
      {content}
    </Link>
  );
};