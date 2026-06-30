import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/formatPrice";
import CourseDetailsIntro from "./_components/CourseDetailsIntro";
import CourseDetails from "./_components/CourseDetails";
import Testimonials from "./_components/Testimonials";
import RelatedCourses from "./_components/RelatedCourses";
import { getCourseDetails, getRelatedCourses } from "@/queries/courses";
import { replaceMongoIdInArray } from "@/lib/convertData";
import MoneyBack from "@/components/money-back";

const SingleCoursePage = async ({ params }) => {
  const { id } = await params;

  // Validate id exists
  if (!id) {
    return notFound();
  }

  const course = await getCourseDetails(id);
  if (!course) return notFound();

  const currentCourseId = (course.id || course._id)?.toString();
  const categoryId = course.category?._id?.toString(); // ✅ يمنع الخطأ

  const relatedCourses =
    currentCourseId && categoryId
      ? await getRelatedCourses(currentCourseId, categoryId)
      : []; // ✅ لو ما فيه category ما نجيب related

  return (
    <>
      <CourseDetailsIntro course={course} />
      <CourseDetails course={course} />

      {course?.testimonials && (
        <Testimonials testimonials={replaceMongoIdInArray(course.testimonials)} />
      )}

      <div className="mb-10">
        <MoneyBack />
      </div>

      <div className="mb-12">
        <RelatedCourses relatedCourses={relatedCourses} />
      </div>
    </>
  );
};

export default SingleCoursePage;
