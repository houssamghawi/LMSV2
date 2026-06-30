"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField, 
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createReview } from "@/app/actions/review";

export const ReviewModal = ({ courseId, loginid, open, setOpen }) => {
  const t = useTranslations("Lesson");
  const tCommon = useTranslations("Common");

  const formSchema = z.object({
    rating: z.coerce
      .number()
      .min(1, { message: t("ratingValidation") })
      .max(5, { message: t("ratingValidation") }),
    review: z.string().min(1, { message: t("descriptionRequired") }),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rating: "",
      review: "",
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (values) => {
    try {
      await createReview(values,loginid,courseId);
      toast.success(t("reviewAdded"));
      setOpen(false);
    } catch (error) {
      toast.error(tCommon("error"));
    }
    console.log(values);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="overflow-y-auto max-h-[90vh]"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogTitle>{t("submitReview")}</DialogTitle>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-8 mt-8"
          >
            {/* rating */}
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("courseRating")}</FormLabel>
                  <FormControl>
                    <Input
                      disabled={isSubmitting}
                      placeholder={t("ratingPlaceholder")}
                      {...field}
                      type="number"
                      min={1}
                      max={5}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* review */}
            <FormField
              control={form.control}
              name="review"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("yourReview")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("reviewPlaceholder")}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("reviewDescription")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-x-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {tCommon("submit")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
