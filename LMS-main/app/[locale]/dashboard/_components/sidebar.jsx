import Logo from "@/components/logo";
import { SidebarRoutes } from "./sidebar-routes";
import { Link } from "@/i18n/navigation";

const Sidebar = () => {
  return (
    <div className="h-full border-e flex flex-col overflow-y-auto bg-white shadow-sm">
      <div className="p-6">
        <Link href="/">
        <Logo />
        </Link> 
      </div>
      <div className="flex flex-col w-full">
        <SidebarRoutes />
      </div>
    </div>
  );
};

export default Sidebar;
