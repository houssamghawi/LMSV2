"use client";

import { Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useState } from "react";
 
import { toast } from "sonner";
 
import { useRouter } from "next/navigation";
import { changeCoursePublishState, deleteCourse } from "@/app/actions/course";

export const CourseActions = ({ courseId, isActive }) => {

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
                    toast.success(newActiveState ? "Course published" : "Course unpublished");
                    router.refresh();
                    break;
                }

                case "delete": {
                    if (published) {
                        toast.error("A published course cannot be deleted. First unpublish it, then delete.");
                    } else {
                        await deleteCourse(courseId);
                        toast.success("The course has been deleted successfully");
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
            toast.error(e.message || "Something went wrong");
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
        {published ? "Unpublish" : "Publish"}
      </Button>

      <Button 
        size="sm" 
        onClick={() => setAction("delete")}
        disabled={isLoading}
      >
        <Trash className="h-4 w-4" />
      </Button>
    </div>   
    </form>
  );
};
