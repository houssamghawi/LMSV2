"use client";

import { Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { changeLessonPublishState, deleteLesson } from "@/app/actions/lesson";
import { toast } from "sonner";

export const LessonActions = ({ lesson, moduleId, onDelete }) => {

    const [action, setAction] = useState(null);
    const [published, setPublished] = useState(lesson?.active);
    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        if (isLoading) return;
        
        setIsLoading(true);
        const previousState = published;
        
        try {
            switch (action) {
                case "change-active": {
                    // Server returns the NEW active state
                    const newActiveState = await changeLessonPublishState(lesson.id);
                    // Set UI to match server state (not inverted)
                    setPublished(newActiveState);
                    toast.success(newActiveState ? "Lesson published" : "Lesson unpublished");
                    break;
                }

                case "delete": {
                    if (published) {
                        toast.error("A published lesson cannot be deleted. First unpublish it, then delete.");
                    } else {
                        await deleteLesson(lesson.id, moduleId);
                        toast.success("The lesson has been deleted successfully");
                        if (onDelete) {
                            onDelete();
                        }
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
