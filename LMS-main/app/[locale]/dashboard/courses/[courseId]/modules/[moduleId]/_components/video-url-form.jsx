"use client";

import dynamic from "next/dynamic";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const VideoPlayer = dynamic(
  () => import("@/components/video-player").then((m) => m.VideoPlayer),
  { ssr: false, loading: () => <div className="aspect-video bg-muted rounded animate-pulse" /> }
);
import { formatDuration} from "@/lib/date";
import { updateLesson } from "@/app/actions/lesson";
import { VideoUploadField } from "./video-upload-field";
import { useTranslations } from "next-intl";
 
const formSchema = z.object({
  url: z.string().min(1, {
    message: "Required",
  }),
  duration: z.string().min(1, {
    message: "Required",
  }),
});

export const VideoUrlForm = ({ initialData, courseId, lessonId }) => {
  const t = useTranslations("ChapterEdit");
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const [state, setState] = useState({
    url: initialData?.url ?? "",
    duration: formatDuration(initialData?.duration) ?? "",
  });

  const toggleEdit = () => setIsEditing((current) => !current);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: state.url ?? "",
      duration: state.duration ?? "",
    },
  });

  const { isSubmitting, isValid } = form.formState;

  const onSubmit = async (values) => {
    try {
      const payload = {};
      payload["video_url"] = values?.url;
      const duration = values?.duration;
      const splitted = duration.split(":");
      if (splitted.length === 3) {
        payload["duration"] = splitted[0] * 3600 + splitted[1] * 60 + splitted[2] * 1;
        await updateLesson(lessonId,payload)
        toast.success(t("lessonUpdated"));
        toggleEdit();
      router.refresh();
      } else {
        toast.error(t("durationFormatError"));
      } 
    } catch {
      toast.error(t("somethingWentWrong"));
    }
  };

  return (
    <div className="mt-6 border bg-slate-100 rounded-md p-4">
      <div className="font-medium flex items-center justify-between">
        {t("videoURL")}
        <Button variant="ghost" onClick={toggleEdit}>
          {isEditing ? (
            <>{t("cancel")}</>
          ) : (
            <>
              <Pencil className="h-4 w-4 me-2" />
              {t("editURL")}
            </>
          )}
        </Button>
      </div>
      {!isEditing && (
        <>
          {initialData?.videoProvider === 'local' ? (
            <>
              <p className="text-sm mt-2">
                {t("localVideo")}: {initialData.videoFilename}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("size")}: {initialData.videoSize ? `${(initialData.videoSize / 1024 / 1024).toFixed(2)} MB` : t("na")}
              </p>
              <div className="mt-6">
                <VideoPlayer url={initialData.videoUrl || state?.url} />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm mt-2">
                {state?.url || t("noVideoURL")}
              </p>
              {state?.url && (
                <div className="mt-6">
                  <VideoPlayer url={state?.url} />
                </div>
              )}
            </>
          )}
        </>
      )}
      {isEditing && (
        <div className="space-y-4 mt-4">
          {/* Video Upload Field */}
          <VideoUploadField 
            lessonId={lessonId}
            initialVideo={initialData?.videoProvider === 'local' ? {
              filename: initialData.videoFilename,
              videoUrl: initialData.videoUrl,
              size: initialData.videoSize,
              mimeType: initialData.videoMimeType
            } : null}
          />
          
          {/* External URL Option (for backward compatibility) */}
          <div className="border-t pt-4">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("externalVideoURL")}</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isSubmitting}
                          placeholder={t("videoURLPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        {t("videoURLHint")}
                      </p>
                    </FormItem>
                  )}
                />
                {/* duration */}
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("videoDuration")}</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isSubmitting}
                          placeholder={t("durationPlaceholder")}
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
          </div>
        </div>
      )}
    </div>
  );
};
