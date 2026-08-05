"use client"
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ReviewModal } from "./review-modal";
import { useState } from "react";

export const GiveReview = ({ courseId, loginid }) => {
  const t = useTranslations("Lesson");
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsReviewModalOpen(true)}
        variant="outline"
        className="w-full mt-6"
      >
        {t("giveReview")}
      </Button>
          <ReviewModal open={isReviewModalOpen} setOpen={setIsReviewModalOpen} courseId={courseId} loginid={loginid} />

        </>
    )
    
}