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
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { getSlug } from "@/lib/convertData";
import { updateLesson } from "@/app/actions/lesson";
import { useTranslations } from "next-intl";

const formSchema = z.object({
  title: z.string().min(1),
});

export const LessonTitleForm = ({ initialData, courseId, lessonId }) => {
  const t = useTranslations("ChapterEdit");
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const [title, setTitle] = useState(initialData?.title);

  const toggleEdit = () => setIsEditing((current) => !current);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title ?? "",
    },
  });

  const { isSubmitting, isValid } = form.formState;

  const onSubmit = async (values) => {
    try {
      values["slug"] = getSlug(values.title);
      await updateLesson(lessonId,values);
      setTitle(values.title);
      toast.success(t("lessonUpdated"));
      toggleEdit();
      router.refresh();
    } catch {
      toast.error(t("somethingWentWrong"));
    }
  };

  return (
    <div className="mt-6 border bg-slate-100 rounded-md p-4">
      <div className="font-medium flex items-center justify-between">
        {t("lessonTitle")}
        <Button variant="ghost" onClick={toggleEdit}>
          {isEditing ? (
            <>{t("cancel")}</>
          ) : (
            <>
              <Pencil className="h-4 w-4 me-2" />
              {t("editTitle")}
            </>
          )}
        </Button>
      </div>
      {!isEditing && (
        <p className="text-sm mt-2">{title}</p>
      )}
      {isEditing && (
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
            <div className="flex items-center gap-x-2">
              <Button disabled={!isValid || isSubmitting} type="submit">
                {t("save")}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
};
