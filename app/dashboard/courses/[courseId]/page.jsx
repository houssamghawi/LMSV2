import { IconBadge } from "@/components/icon-badge";
import {
  CircleDollarSign,
  LayoutDashboard,
  ListChecks,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CategoryForm } from "./_components/category-form";
import { DescriptionForm } from "./_components/description-form";
import { ImageForm } from "./_components/image-form";
import { ModulesForm } from "./_components/module-form";
import { PriceForm } from "./_components/price-form";
import { TitleForm } from "./_components/title-form";
import { CourseActions } from "./_components/course-action";
import AlertBanner from "@/components/alert-banner";
import { getCourseDetails } from "@/queries/courses";
import { SubTitleForm } from "./_components/subtitle-form";
import { getCategories } from "@/queries/categories";
import { replaceMongoIdInArray } from "@/lib/convertData";
import { ObjectId } from "mongoose";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { getCourseWithOwnershipCheck } from "@/lib/authorization";
import { notFound } from "next/navigation";

const EditCourse = async ({ params }) => {
  const { courseId } = await params;
  
  // Security: Verify ownership before allowing edit access
  const loggedInUser = await getLoggedInUser();
  if (!loggedInUser) {
    notFound();
  }
  
  const course = await getCourseWithOwnershipCheck(courseId, loggedInUser.id, loggedInUser);
  
  // If user doesn't own this course, return 404 to prevent info leakage
  if (!course) {
    notFound();
  }
  const categories = await getCategories();

  const mappedCategories = categories.map((c) => ({
    value: c.title,
    label: c.title,
    id: c.id,
  }));

  // Sanitize ObjectId & Buffer
  function sanitizeData(data) {
    return JSON.parse(
      JSON.stringify(data, (key, value) => {
        if (value instanceof ObjectId) return value.toString();
        if (Buffer.isBuffer(value)) return value.toString("base64");
        return value;
      })
    );
  }

  const rawModules = replaceMongoIdInArray(course?.modules || []).sort(
    (a, b) => a.order - b.order
  );
  const modules = sanitizeData(rawModules);

  // ✅ FIX: safe image url (avoid /undefined)
  const courseImageUrl = course?.thumbnail
    ? `/assets/images/courses/${course.thumbnail}`
    : "";

  return (
    <>
      {!course?.active && (
        <AlertBanner
          label="This course is unpublished. It will not be visible in the course."
          variant="warning"
        />
      )}

      <div className="p-6">
        <div className="flex items-center justify-between">
          <Link href={`/dashboard/courses/${courseId}/quizzes`}>
            <Button variant="outline">
              <ListChecks className="w-4 h-4 mr-2" />
              Quizzes
            </Button>
          </Link>
          <CourseActions courseId={courseId} isActive={course?.active} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16">
          {/* Left */}
          <div>
            <div className="flex items-center gap-x-2">
              <IconBadge icon={LayoutDashboard} />
              <h2 className="text-xl">Customize your course</h2>
            </div>

            <TitleForm
              initialData={{ title: course?.title }}
              courseId={courseId}
            />

            <SubTitleForm
              initialData={{ subtitle: course?.subtitle }}
              courseId={courseId}
            />

            <DescriptionForm
              initialData={{ description: course?.description }}
              courseId={courseId}
            />

            <ImageForm
              initialData={{ imageUrl: courseImageUrl }}
              courseId={courseId}
            />

            <CategoryForm
              initialData={{ value: course?.category?.title }}
              courseId={courseId}
              options={mappedCategories}
            />
          </div>

          {/* Right */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-x-2 mb-6">
                <IconBadge icon={ListChecks} />
                <h2 className="text-xl">Course Modules</h2>
              </div>

              <ModulesForm initialData={modules} courseId={courseId} />
            </div>

            <div>
              <div className="flex items-center gap-x-2">
                <IconBadge icon={CircleDollarSign} />
                <h2 className="text-xl">Sell your course</h2>
              </div>

              <PriceForm
                initialData={{ price: course?.price }}
                courseId={courseId}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditCourse;
