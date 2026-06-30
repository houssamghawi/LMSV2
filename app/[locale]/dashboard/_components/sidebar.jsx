import Logo from "@/components/logo";
import { SidebarRoutes } from "./sidebar-routes";
import { Link } from "@/i18n/navigation";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { getPendingGradingCount } from "@/queries/quizv2";

const Sidebar = async () => {
  let pendingGradingCount = 0;
  let showGrading = false;
  try {
    const user = await getLoggedInUser();
    if (user && (user.role === "instructor" || user.role === "admin")) {
      showGrading = true;
      const counts = await getPendingGradingCount(user.id, user.role);
      pendingGradingCount = counts?.total || 0;
    }
  } catch (e) {
    // Sidebar is rendered on every dashboard route; never let it crash the page.
    console.error("[SIDEBAR] grading count load failed:", e);
  }

  return (
    <div className="h-full border-e flex flex-col overflow-y-auto bg-white shadow-sm">
      <div className="p-6">
        <Link href="/">
        <Logo />
        </Link>
      </div>
      <div className="flex flex-col w-full">
        <SidebarRoutes
          pendingGradingCount={pendingGradingCount}
          showGrading={showGrading}
        />
      </div>
    </div>
  );
};

export default Sidebar;
