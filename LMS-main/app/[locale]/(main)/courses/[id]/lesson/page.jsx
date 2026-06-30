import { getTranslations } from "next-intl/server";
import { Separator } from "@/components/ui/separator";
import VideoDescription from "./_components/video-description";
import { LessonVideoWrapper } from "./_components/lesson-video-wrapper";
import { getCourseDetails } from "@/queries/courses";
import { replaceMongoIdInArray, replaceMongoIdInObject } from "@/lib/convertData";
import { getLessonBySlug } from "@/queries/lessons";

export const dynamic = "force-dynamic";

const Course = async ({ params, searchParams }) => {
	const { id } = await params;
	const resolvedSearchParams = await searchParams;
	const { name, module } = resolvedSearchParams || {};
	const course = await getCourseDetails(id);
	const allModules = course?.modules ? replaceMongoIdInArray(course.modules).toSorted((a, b) => a.order - b.order) : [];

	const defaultLesson = allModules.length > 0 && allModules[0]?.lessonIds?.length > 0
		? replaceMongoIdInObject(allModules[0].lessonIds.toSorted((a, b) => a.order - b.order)[0])
		: null;

	const lessonToPay = name ? await getLessonBySlug(name) : defaultLesson;

	const defaultModule = module ?? (allModules.length > 0 ? allModules[0].slug : null);

	// Serialize for client components (strip ObjectId/Buffer/toJSON)
	const lessonPlain = lessonToPay ? JSON.parse(JSON.stringify(lessonToPay)) : null;

	if (!lessonPlain) {
		const t = await getTranslations("Lesson");
		return (
			<div className="flex flex-col max-w-4xl mx-auto pb-20 p-4">
				<div className="text-center py-12">
					<p className="text-slate-500">{t("noLessonFound")}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col w-full max-w-4xl mx-auto pb-12">
			{/* Video section */}
			<section className="w-full rounded-lg overflow-hidden bg-muted/30">
				<LessonVideoWrapper courseId={id} lesson={lessonPlain} module={defaultModule} />
			</section>

			{/* Lesson details - dir="auto" for correct direction of mixed content (e.g. English titles on Arabic pages) */}
			<section className="mt-6 space-y-4" dir="auto">
				<h1 className="text-2xl font-semibold">{lessonPlain.title}</h1>
				<Separator />
				<VideoDescription description={lessonPlain.description} />
			</section>
		</div>
	);
};
export default Course;
