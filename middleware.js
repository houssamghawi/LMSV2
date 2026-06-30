import { auth } from "@/auth-edge";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { PUBLIC_ROUTES, LOGIN, ROOT } from "@/lib/routes";
import { ROLES } from "@/lib/permissions";
import { getRedirectUrlByRole } from "@/lib/auth-redirect";
import { addSecurityHeaders } from "@/lib/security-headers";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

/**
 * Extract locale from pathname (en|ar), fallback to defaultLocale.
 */
function getLocaleFromPathname(pathname) {
  return pathname.match(/^\/(en|ar)/)?.[1] ?? routing.defaultLocale;
}

/**
 * Strip locale prefix from pathname for auth logic.
 * E.g. /en/login -> /login, /ar/dashboard -> /dashboard, /en -> /
 */
function getPathnameWithoutLocale(pathname) {
  const match = pathname.match(/^\/(en|ar)(\/|$)/);
  if (match) {
    const suffix = match[2];
    return suffix === "/" ? pathname.slice(match[0].length - 1) || "/" : "/";
  }
  return pathname;
}

const ROLE_PROTECTED_ROUTES = [
  { prefix: "/admin", allowedRoles: [ROLES.ADMIN] },
  { prefix: "/dashboard", allowedRoles: [ROLES.INSTRUCTOR, ROLES.ADMIN] },
];

function isPublicRoute(pathWithoutLocale) {
  return pathWithoutLocale === ROOT || PUBLIC_ROUTES.some((route) => pathWithoutLocale.startsWith(route));
}

function getRoleRestriction(pathWithoutLocale) {
  return ROLE_PROTECTED_ROUTES.find(({ prefix }) => pathWithoutLocale.startsWith(prefix));
}

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const locale = getLocaleFromPathname(pathname);
  const pathWithoutLocale = getPathnameWithoutLocale(pathname);

  const isAuthenticated = !!req.auth;
  const user = req.auth?.user;
  const userRole = user?.role;
  const userStatus = user?.status;

  const localePath = (path) => `/${locale}${path === "/" ? "" : path}`;

  // ----- 1. Logged-in users: redirect away from login/register -----
  if (pathWithoutLocale === LOGIN && isAuthenticated && userRole) {
    return addSecurityHeaders(
      NextResponse.redirect(new URL(localePath(getRedirectUrlByRole(userRole)), nextUrl)),
      req
    );
  }
  if (
    (pathWithoutLocale.startsWith("/register/student") || pathWithoutLocale.startsWith("/register/instructor")) &&
    isAuthenticated &&
    userRole
  ) {
    return addSecurityHeaders(
      NextResponse.redirect(new URL(localePath(getRedirectUrlByRole(userRole)), nextUrl)),
      req
    );
  }

  // ----- 2. Authenticated but inactive/suspended: force re-auth -----
  if (isAuthenticated && userStatus && userStatus !== "active") {
    const loginUrl = new URL(localePath(LOGIN), nextUrl);
    loginUrl.searchParams.set("error", "account_inactive");
    return addSecurityHeaders(NextResponse.redirect(loginUrl), req);
  }

  // ----- 3. Require auth for any non-public route -----
  if (!isAuthenticated && !isPublicRoute(pathWithoutLocale)) {
    const loginUrl = new URL(localePath(LOGIN), nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return addSecurityHeaders(NextResponse.redirect(loginUrl), req);
  }

  // ----- 4. RBAC: strict role check at edge -----
  const roleRestriction = getRoleRestriction(pathWithoutLocale);
  if (roleRestriction) {
    const { allowedRoles } = roleRestriction;
    if (!isAuthenticated) {
      const loginUrl = new URL(localePath(LOGIN), nextUrl);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return addSecurityHeaders(NextResponse.redirect(loginUrl), req);
    }
    if (userStatus && userStatus !== "active") {
      const loginUrl = new URL(localePath(LOGIN), nextUrl);
      loginUrl.searchParams.set("error", "account_inactive");
      return addSecurityHeaders(NextResponse.redirect(loginUrl), req);
    }
    const hasRole = allowedRoles.includes(userRole);
    if (!hasRole) {
      return addSecurityHeaders(
        NextResponse.redirect(new URL(localePath(ROOT), nextUrl)),
        req
      );
    }
  }

  // ----- 5. Run next-intl locale routing and apply security headers -----
  return addSecurityHeaders(intlMiddleware(req), req);
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/",
  ],
};
