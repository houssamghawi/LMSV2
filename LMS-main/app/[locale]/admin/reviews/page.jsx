import { getAdminUser } from "@/lib/admin-utils";
import ReviewsTable from "./_components/reviews-table";
import { getTranslations } from "next-intl/server";
import { dbConnect } from "@/service/mongo";
import { Testimonial } from "@/model/testimonial-model";
import { replaceMongoIdInArray } from "@/lib/convertData";

// Ensure fresh data from database on every request
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getReviews() {
    await dbConnect();
    const reviews = await Testimonial.find()
        .populate({
            path: 'user',
            select: 'firstName lastName email profilePicture'
        })
        .populate({
            path: 'courseId',
            select: 'title'
        })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    return replaceMongoIdInArray(reviews);
}

export const metadata = {
    title: "Reviews Management - Admin",
    description: "Manage course reviews and testimonials"
};

export default async function ReviewsPage() {
    await getAdminUser();
    const t = await getTranslations("Admin");
    
    // Fetch fresh reviews data directly from database
    const reviews = await getReviews();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">{t("reviewsManagement")}</h1>
                <p className="text-gray-600 mt-2">{t("manageReviewsSub")}</p>
            </div>

            <ReviewsTable reviews={reviews || []} />
        </div>
    );
}

