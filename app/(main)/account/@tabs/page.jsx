import { redirect } from "next/navigation";
import PersonalDetails from "../component/personal-details";
import ContactInfo from "../component/contact-info";
import ChangePassword from "../component/change-password";
import { auth } from "@/auth";
import { getUserByEmail } from "@/queries/users";
import { dbConnect } from "@/service/mongo";

async function Profile() {
	// Authentication check
	const session = await auth();

	if (!session?.user?.email) {
		redirect("/login");
	}

	try {
		// Ensure database connection
		await dbConnect();

		// Get user data
		const loggedInUser = await getUserByEmail(session.user.email);

		if (!loggedInUser) {
			redirect("/login");
		}

		return (
			<>
				<PersonalDetails userInfo={loggedInUser} />
				<div className="p-6 rounded-md shadow dark:shadow-gray-800 bg-white dark:bg-slate-900 mt-[30px]">
					<div className="grid lg:grid-cols-2 grid-cols-1 gap-5">
						<ContactInfo userInfo={loggedInUser} />
						<ChangePassword email={loggedInUser?.email} />
					</div>
				</div>
			</>
		);
	} catch (error) {
		console.error('Profile page error:', error);
		redirect("/login");
	}
}

export default Profile;
