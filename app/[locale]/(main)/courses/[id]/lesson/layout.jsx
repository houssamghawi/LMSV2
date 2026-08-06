import { CourseSidebarMobile } from "./_components/course-sidebar-mobile";
import { CourseSidebar } from "./_components/course-sidebar";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { redirect } from "next/navigation";
import { hasEnrollmentForCourse } from "@/queries/enrollments";

export const dynamic = "force-dynamic";

const CourseLayout = async ({ children, params }) => {
  const { id } = await params;
  const loggedinUser = await getLoggedInUser();
  if (!loggedinUser) {
    redirect("/login");
  }

  const isEnrolled = await hasEnrollmentForCourse(id, loggedinUser.id);
  if (!isEnrolled) {
    redirect("/courses");
  }

  return (
    <div className="min-h-screen flex">
      {/* Mobile header with sidebar toggle */}
      <div className="h-[80px] lg:ps-96 fixed top-[60px] inset-inline-start-0 inset-inline-end-0 z-10">
        <div className="flex lg:hidden p-4 border-b h-full items-center bg-white shadow-sm">
          <CourseSidebarMobile>
            <CourseSidebar courseId={id} />
          </CourseSidebarMobile>
        </div>
      </div>

      {/* Desktop: fixed sidebar (start side) + scrollable main */}
      <aside className="hidden lg:flex lg:fixed lg:top-[60px] lg:inset-inline-start-0 lg:bottom-0 lg:w-96 lg:flex-col lg:z-40">
        <CourseSidebar courseId={id} />
      </aside>

      <main className="flex-1 min-w-0 lg:ps-96 pt-[80px] lg:pt-5 lg:pb-8 px-4">
        {children}
      </main>
    </div>
  );
};
export default CourseLayout;
