

import { getCategoryById, getCourseList, getCoursesByCategory } from "@/queries/courses";
import CourseCard from "../../courses/_components/CourseCard";


const CoursesCatgoryPage = async ({ params }) => {
  const { id } = await params;
  const courses = await getCoursesByCategory(id);
  const category = await getCategoryById(id);
  //console.log(category);

  const modifiedCourses = courses.map(course => ({
    ...course,
    id: course._id.toString(),
  }))
  // console.log(modifiedCourses);

  return (
    <section
      id="courses"
      className="container space-y-6   dark:bg-transparent py-6"
    >

      <div className="flex items-baseline justify-between  border-gray-200 border-b pb-6 flex-col gap-4 lg:flex-row">

        <h2 className="text-3xl font-bold">Category Name : {category?.title}</h2>
      </div>



      <section className="pb-24 pt-6">
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-4">

          <div className="lg:col-span-4 grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-3 gap-4">
            {modifiedCourses.map((course) => {
              return (
                <CourseCard key={course.id} course={course} />
              );
            })}
          </div>
        </div>
      </section>
    </section>
  );
};
export default CoursesCatgoryPage;
