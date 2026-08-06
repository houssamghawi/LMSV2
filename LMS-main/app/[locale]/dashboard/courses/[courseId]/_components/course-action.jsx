"use client";

import { Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
 
import { useRouter } from "next/navigation";
import { changeCoursePublishState, deleteCourse } from "@/app/actions/course";

export const CourseActions = ({ courseId, isActive }) => {
    const t = useTranslations("CourseEdit");
    const [action, setAction] = useState(null);
    const [published, setPublished] = useState(isActive);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(event) {
        event.preventDefault();
        if (isLoading) return;
        
        setIsLoading(true);
        const previousState = published;
        
        try {
            switch (action) {
                case "change-active": {
                    // Server returns the NEW active state
                    const newActiveState = await changeCoursePublishState(courseId);
                    // Set UI to match server state (not inverted)
                    setPublished(newActiveState);
                    toast.success(newActiveState ? t("coursePublished") : t("courseUnpublished"));
                    router.refresh();
                    break;
                }

                case "delete": {
                    if (published) {
                        toast.error(t("publishedCannotDelete"));
                    } else {
                        await deleteCourse(courseId);
                        toast.success(t("courseDeleted"));
                        router.push(`/dashboard/courses`);
                    }
                    break;
                } 
                default:
                    throw new Error("Invalid action");
            }
        } catch (e) {
            // Revert UI state on error
            setPublished(previousState);
            toast.error(e.message || t("somethingWentWrong"));
        } finally {
            setIsLoading(false);
            setAction(null);
        }
    }


  return (
    <form onSubmit={handleSubmit}>
    <div className="flex items-center gap-x-2">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setAction("change-active")}
        disabled={isLoading}
      >
        {published ? t("unpublish") : t("publish")}
      </Button>

      <Button 
        size="sm" 
        onClick={() => setAction("delete")}
        disabled={isLoading}
      >
        <Trash className="h-4 w-4" aria-label={t("delete")} />
      </Button>
    </div>   
    </form>
  );
};
