import { getCourseDetails } from "@/queries/courses";
import { DataTable } from "./_components/data-table";
import { ENROLLMENT_DATA, getInstructorDashboardData } from "@/lib/dashboard-helper";
import { ObjectId } from "mongoose";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { getCourseWithOwnershipCheck } from "@/lib/authorization";
import { notFound } from "next/navigation";

const EnrollmentsPage = async ({ params }) => {
  const { courseId } = await params;
  
  // Security: Verify ownership before showing enrollments
  const loggedInUser = await getLoggedInUser();
  if (!loggedInUser) {
    notFound();
  }
  
  const course = await getCourseWithOwnershipCheck(courseId, loggedInUser.id, loggedInUser);
  
  if (!course) {
    notFound();
  }
  const allEnrollments = await getInstructorDashboardData(ENROLLMENT_DATA);

  const enrollmentData = sanitizeData(allEnrollments)

  const enrollmentForCourse = enrollmentData.filter((enrollment) => enrollment?.course?.toString() === courseId)

  // console.log(enrollmentForCourse)

  return (
    <div className="p-6">
      {/* <Link href="/teacher/create">
        <Button>New Course</Button>
      </Link> */}
      <h2 className="text-3xl text-gray-700 font-bold">{course?.title}</h2>
      <DataTable data={enrollmentForCourse} />
    </div>
  );
};

// Sanitize fucntion for handle ObjectID and Buffer
function sanitizeData(data) {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (value instanceof ObjectId) {
        return value.toString();
      }
      if (Buffer.isBuffer(value)) {
        return value.toString("base64")
      }
      return value;
    })
  );
}

export default EnrollmentsPage;
