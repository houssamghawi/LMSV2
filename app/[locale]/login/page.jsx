import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRedirectUrlByRole } from "@/lib/auth-redirect";
import { LoginForm } from "./_components/login-form";

const LoginPage = async () => {
  // Server-side check: redirect if already logged in
  const session = await auth();
  
  if (session?.user?.role) {
    const redirectUrl = getRedirectUrlByRole(session.user.role);
    redirect(redirectUrl);
  }

  return (
    <div className="w-full flex-col h-screen flex items-center justify-center">
      <div className="container">
        <LoginForm />
      </div>
    </div>
  );
};
export default LoginPage;
