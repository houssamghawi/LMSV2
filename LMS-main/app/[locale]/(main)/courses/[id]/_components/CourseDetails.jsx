import { Tabs,TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 
import CourseOverview from "./CourseOverview";
import CourseCurriculam from "./CourseCurriculam";
import CourseInstructor from "./CourseInstructor";
import { SafeImage } from "@/components/safe-image";
import { formatMyDate } from "@/lib/date";
import { getTranslations } from "next-intl/server";

const CourseDetails = async ({ course }) => {
  const t = await getTranslations("Courses");
  const lastModifiedDate = formatMyDate(course.modifiedOn);



    return (
        <section className="py-8 md:py-12 lg:py-24">
        <div className="container">
          <span className="bg-green-500 px-4 py-0.5 rounded-full text-xs font-medium text-white inline-block">
            {course?.category?.title}
          </span>
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold 2xl:text-5xl mt-3">
          {course?.title}
          </h3>
          <p className="mt-3 text-gray-600 text-sm">
          {course?.subtitle}
          </p>
          {/*  */}
          <div className="flex sm:items-center gap-5 flex-col sm:flex-row sm:gap-6 md:gap-20 mt-6">
            <div className="flex items-center gap-2">
              <SafeImage
                className="w-[40px] h-[40px] rounded-full object-cover"
                src={course?.instructor?.profilePicture}
                alt={course?.instructor?.firstName}
                width={40}
                height={40}
                fallback="/assets/images/profile.jpg"
              />
              <p className="font-bold">{course?.instructor?.firstName} {' '} {course?.instructor?.lastName}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-success font-semibold">{t("lastUpdated")}: </span>
              <span>{lastModifiedDate}</span>
            </div>
          </div>

          {/* Tab */}
          <div className="my-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3 my-6 max-w-[768px]">
                <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
                <TabsTrigger value="curriculum">{t("curriculum")}</TabsTrigger>
                <TabsTrigger value="instructor">{t("instructor")}</TabsTrigger>
                {/* <TabsTrigger value="reviews">Reviews</TabsTrigger> */}
              </TabsList>


              <TabsContent value="overview">
                {/* each tab content can be independent component */}
               <CourseOverview course={course}/> 
              </TabsContent>


              <TabsContent value="curriculum">
                {/* each tab content can be independent component */}
           
            <CourseCurriculam course={course} />
                
              </TabsContent>
              <TabsContent value="instructor">
                {/* each tab content can be independent component */}
            <CourseInstructor course={course}/>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>
    );
};

export default CourseDetails;