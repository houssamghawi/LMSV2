import { Button } from "@/components/ui/button";
import { VideoPlayer } from "./_components/video-player";
import { Separator } from "@/components/ui/separator";
import VideoDescription from "./_components/video-description";
import { getCourseDetails } from "@/queries/courses";
import { replaceMongoIdInArray, replaceMongoIdInObject } from "@/lib/convertData";
import { getLessonBySlug } from "@/queries/lessons";
import { LessonVideo } from "./_components/lesson-video";

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

	//console.log({lessonToPay});




	if (!lessonToPay) {
		return (
			<div className="flex flex-col max-w-4xl mx-auto pb-20 p-4">
				<div className="text-center py-12">
					<p className="text-slate-500">No lesson found. Please select a lesson from the sidebar.</p>
				</div>
			</div>
		);
	}

	return (
		<div>
			<div className="flex flex-col max-w-4xl mx-auto pb-20">
				<div className="p-4 w-full">
					<LessonVideo courseId={id} lesson={lessonToPay} module={defaultModule} />
				</div>
				<div>
					<div className="p-4 flex flex-col md:flex-row items-center justify-between">
						<h2 className="text-2xl font-semibold mb-2">{lessonToPay.title}</h2>

					</div>
					<Separator />
					<VideoDescription description={lessonToPay.description} />
				</div>
			</div>
		</div>
	);
};
export default Course;
