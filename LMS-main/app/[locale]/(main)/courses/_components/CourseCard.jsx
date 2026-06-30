"use client";
import React from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/formatPrice";
import { BookOpen } from "lucide-react";
import EnrollCourse from "@/components/enroll-course";
import { useTranslations } from "next-intl";
import { getSafeImagePath } from "@/lib/utils";

const CourseCard = ({ course }) => {
  const t = useTranslations("Courses");
  const thumbnailSrc = getSafeImagePath(course?.thumbnail);

  // Get course ID - handle both id and _id formats
  const courseId = course?.id || course?._id?.toString() || course?._id;

  return (
    <div className="group hover:shadow-sm transition overflow-hidden border rounded-lg p-3 h-full">
      <Link href={`/courses/${courseId}`} className="block">
        <div className="relative w-full aspect-video rounded-md overflow-hidden">
          <Image
            src={thumbnailSrc}
            alt={course?.title || t("course")}
            className="object-cover"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>

        <div className="flex flex-col pt-2">
          <div className="text-lg md:text-base font-medium group-hover:text-sky-700 line-clamp-2">
            {course?.title}
          </div>

          <p className="text-xs text-muted-foreground">
            {course?.category?.title}
          </p>

          <div className="my-3 flex items-center gap-x-2 text-sm md:text-xs">
            <div className="flex items-center gap-x-1 text-slate-500">
              <BookOpen className="w-4" />
              <span>{course?.modules?.length || 0} {t("chapters")}</span>
            </div>
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between mt-4">
        <p className="text-md md:text-sm font-medium text-slate-700" suppressHydrationWarning>
          {formatPrice(course?.price)}
        </p>

        <EnrollCourse asLink={true} courseId={courseId} />
      </div>
    </div>
  );
};

export default CourseCard;
