import React from 'react';
import { Presentation } from "lucide-react";
import { UsersRound } from "lucide-react";
import { Star } from "lucide-react";
import { MessageSquare } from "lucide-react";
import { SafeImage } from "@/components/safe-image";
import { getCourseDetailsByInstructor } from '@/queries/courses';
import { Link } from '@/i18n/navigation';
import { getTranslations } from "next-intl/server";

const CourseInstructor = async ({ course }) => {
  const t = await getTranslations("Courses");
  const instructor = course?.instructor;
  const fullName = `${instructor?.firstName} ${instructor?.lastName}`
  //console.log(course);


  const instructorId = instructor?.id ?? instructor?._id?.toString?.();
  const courseDetailsByInstructor = instructorId
    ? await getCourseDetailsByInstructor(instructorId)
    : null;

  // console.log(courseDetailsByInstructor);

    return (
        <div className="bg-gray-50 rounded-md p-8">
        <div className="md:flex md:gap-x-5 mb-8">
          <div className="h-[310px] w-[270px] max-w-full  flex-none rounded mb-5 md:mb-0">
            <SafeImage
              src={instructor?.profilePicture}
              alt={fullName}
              width={200}
              height={200}
              className="w-full h-full object-cover rounded"
              fallback="/assets/images/profile.jpg"
            />
          </div>
          <div className="flex-1">
            <div className="max-w-[300px]">
              <h4 className="text-[34px] font-bold leading-[51px]">
              {fullName}
              </h4>
              <div className="text-gray-600 font-medium mb-6">
              {instructor?.designation}
              </div>
              <ul className="list space-y-4">
                <li className="flex items-center gap-x-3">
                  <Presentation className="text-gray-600" />
                  <div>{courseDetailsByInstructor?.courses} {t("coursesCount")}</div>
                </li>
                <li className="flex gap-x-3">
                  <UsersRound className="text-gray-600" />
                  <div>{courseDetailsByInstructor?.enrollments}+ {t("studentLearned")}</div>
                </li>
                <li className="flex gap-x-3">
                  <MessageSquare className="text-gray-600" />
                  <div>{courseDetailsByInstructor?.reviews} {t("reviews")}</div>
                </li>
                <li className="flex gap-x-3">
                  <Star className="text-gray-600" />
                  <div>{courseDetailsByInstructor?.ratings} {t("averageRating")}</div>
                </li>

                <li className="flex gap-x-3">
                  <Link href={`/inst-profile/${instructor?.id ?? instructor?._id}`}>
                    <div className='text-red-600 font-bold'>
                      {t("seeProfile")}
                    </div>
                  </Link>
                </li>


              </ul>
            </div>
          </div>
        </div>
        <p className="text-gray-600">
        {instructor?.bio}
        </p>
      </div>
    );
};

export default CourseInstructor;