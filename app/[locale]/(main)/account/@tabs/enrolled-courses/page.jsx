import EnrolledCourseCard from "../../component/enrolled-coursecard";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserByEmail } from "@/queries/users";
import { getEnrollmentsForUser } from "@/queries/enrollments";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

async function EnrolledCourses() {
	const t = await getTranslations("Account");
	const session = await auth();
	if (!session?.user) {
		redirect("/login");
	}

	const loggedInUser = await getUserByEmail(session?.user?.email);
	 
	const enrollments = await getEnrollmentsForUser(loggedInUser?.id)
	//console.log(enrollments);

	return (
	<>
	<div className="mb-6">
		<h2 className="text-2xl font-bold">{t("enrolledCoursesPageTitle")}</h2>
		<p className="text-muted-foreground mt-1">{t("enrolledCoursesPageDescription")}</p>
	</div>
	<div className="grid sm:grid-cols-2 gap-6">
		{
			enrollments && enrollments.length > 0 ? (
				<>
				{ enrollments.map((enrollment) => (
					<Link
					key={enrollment?.id}
					href={`/courses/${enrollment.course._id.toString()}/lesson`}
					> 
					<EnrolledCourseCard key={enrollment?.id} enrollment={enrollment}  />
					</Link>
				))}
				</>

			) : (
				<p className="font-bold text-red-700">{t("noEnrollmentsFound")}</p>
			)
		}
			
	</div>
	</>
	);
}

export default EnrolledCourses;
