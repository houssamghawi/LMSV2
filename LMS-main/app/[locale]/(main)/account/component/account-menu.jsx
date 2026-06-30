"use client";
import { signOut } from "next-auth/react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import React from "react";

const MENU_ITEMS = [
	{ labelKey: "profile", href: "/account" },
	{ labelKey: "enrolledCourses", href: "/account/enrolled-courses" },
];

function Menu() {
	const t = useTranslations("Account");
	const pathname = usePathname();
	return (
		<ul className="list-none sidebar-nav mb-0 mt-3" id="navmenu-nav">
			{MENU_ITEMS.map((item, i) => (
				<li className="navbar-item account-menu" key={i}>
					<Link
						href={item.href}
						className={`navbar-link flex items-center py-2 rounded ${
							pathname === item.href ? "text-primary" : "text-slate-400"
						}`}>
						<h6 className="mb-0 font-semibold">{t(item.labelKey)}</h6>
					</Link>
				</li>
			))}
			<li className="navbar-item account-menu">
				<Link
					href="#"
					onClick={(e) => {
						e.preventDefault();
						signOut({ callbackUrl: "/" });
					}}
					className="navbar-link text-slate-400 flex items-center py-2 rounded">
					<h6 className="mb-0 font-semibold">{t("signOut")}</h6>
				</Link>
			</li>
		</ul>
	);
}

export default Menu;
