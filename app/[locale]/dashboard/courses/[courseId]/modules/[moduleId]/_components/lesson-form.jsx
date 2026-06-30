"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { LessonList } from "./lesson-list";
import { LessonModal } from "./lesson-modal";
import { getSlug } from "@/lib/convertData";
import { createLesson, reOrderLesson } from "@/app/actions/lesson";
import { useTranslations } from "next-intl";

const formSchema = z.object({
  title: z.string().min(1),
});
  
export const LessonForm = ({ initialData, moduleId,courseId }) => {
  const t = useTranslations("ChapterEdit");
  const [isEditing, setIsEditing] = useState(false);
  const [lessons, setLessons] = useState(initialData);
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [lessonToEdit, setLessonToEdit] = useState(null);

  const toggleCreating = () => setIsCreating((current) => !current);
  const toggleEditing = () => setIsEditing((current) => !current);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
    },
  });

  const { isSubmitting, isValid } = form.formState;

  const onSubmit = async (values) => {
      try {
  
        const formData = new FormData();
        formData.append("title", values?.title);
        formData.append("slug", getSlug(values?.title));
        formData.append("moduleId",moduleId);
        formData.append("order", lessons.length)
  
        const lesson = await createLesson(formData); 
  
        setLessons((lessons) => [
          ...lessons,
          {
            id: lesson?.id ?? lesson?._id?.toString?.(),
            title: values.title,
          },
        ]);
        toast.success(t("lessonCreated"));
        toggleCreating();
        router.refresh();
      } catch (error) {
        toast.error(t("somethingWentWrong"));
      }
    }; 
 
  const onReorder = async (updateData) => {
    console.log({ updateData });
    try {
      setIsUpdating(true);
      await reOrderLesson(updateData);
      toast.success(t("lessonReordered"));
      router.refresh();
    } catch {
      toast.error(t("somethingWentWrong"));
    } finally {
      setIsUpdating(false);
    }
  };

  const onEdit = (id) => {
    const foundLesson = lessons.find(lessons => lessons.id === id);
    setLessonToEdit(foundLesson);
    setIsEditing(true);
  };

  return (
    <div className="relative mt-6 border bg-slate-100 rounded-md p-4">
      {isUpdating && (
        <div className="absolute h-full w-full bg-gray-500/20 inset-0 rounded-md flex items-center justify-center">
          <Loader2 className="animate-spin h-6 w-6 text-sky-700" />
        </div>
      )}
      <div className="font-medium flex items-center justify-between">
        {t("moduleLessonsTypo")}
        <Button variant="ghost" onClick={toggleCreating}>
          {isCreating ? (
            <>{t("cancel")}</>
          ) : (
            <>
              <PlusCircle className="h-4 w-4 me-2" />
              {t("addChapter")}
            </>
          )}
        </Button>
      </div>

      {isCreating && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 mt-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      disabled={isSubmitting}
                      placeholder={t("modulePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button disabled={!isValid || isSubmitting} type="submit">
              {t("create")}
            </Button>
          </form>
        </Form>
      )}
      {!isCreating && (
        <div
          className={cn(
            "text-sm mt-2",
            !lessons?.length && "text-slate-500 italic"
          )}
        >
          {!lessons?.length && t("noModule")}
          <LessonList
            onEdit={onEdit}
            onReorder={onReorder}
            items={lessons || []}
          />
        </div>
      )}
      {!isCreating && (
        <p className="text-xs text-muted-foreground mt-4">
          {t("dragDropReorder")}
        </p>
      )}
      <LessonModal open={isEditing} setOpen={setIsEditing} courseId={courseId} lesson={lessonToEdit} moduleId={moduleId} />
    </div>
  );
};
