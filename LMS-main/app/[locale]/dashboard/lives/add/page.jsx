"use client";
import * as z from "zod";
import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { UploadDropzone } from "@/components/file-upload";
import { Combobox } from "@/components/ui/combobox";
import { useTranslations } from "next-intl";

const AddLive = () => {
  const t = useTranslations("Lives");
  const router = useRouter();

  const formSchema = useMemo(
    () =>
      z.object({
        title: z.string().min(1, { message: t("titleRequired") }),
        date: z.date({ required_error: t("dateRequired") }),
        time: z.string({ required_error: t("timeRequired") }).min(1, { message: t("timeRequired") }),
        description: z.string().min(1, { message: t("descriptionRequired") }),
        thumbnail: z.string().min(1, { message: t("thumbnailRequired") }),
        url: z.string().min(1, { message: t("thumbnailRequired") }),
      }),
    [t]
  );

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      date: "",
      time: "",
    },
  });

  const { isSubmitting, isValid } = form.formState;

  const onSubmit = async (values) => {
    try {
      router.push(`/dashboard/lives`);
      toast.success(t("liveCreated"));
    } catch (error) {
      toast.error(t("somethingWentWrong"));
    }
  };
  return (
    <section className="py-8">
      <div className="max-w-5xl mx-auto flex md:items-center md:justify-center h-full p-6">
        <div className="max-w-full w-[536px]">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-8 mt-8"
            >
              {/* title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("liveTitle")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isSubmitting}
                        placeholder={t("titlePlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Thumbnail */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("thumbnail")}</FormLabel>
                    <FormControl>
                      <UploadDropzone />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* date */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("date")}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "ps-3 text-start font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>{t("pickDate")}</span>
                            )}
                            <CalendarIcon className="ms-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      {t("descriptionHint")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* time */}
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("time")}</FormLabel>
                    <FormControl>
                      <Input
                        className="block"
                        disabled={isSubmitting}
                        placeholder={t("selectTime")}
                        {...field}
                        type="time"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* video url */}
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("videoURL")}</FormLabel>
                    <FormControl>
                      <Input
                        className="block"
                        disabled={isSubmitting}
                        placeholder={t("videoURLPlaceholder")}
                        {...field}
                        type="url"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("liveDescription")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("liveOverview")}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("descriptionHint")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center gap-x-2">
                <Link href="/dashboard/lives">
                  <Button variant="outline" type="button">
                    {t("cancel")}
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {t("continue")}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </section>
  );
};

export default AddLive;
