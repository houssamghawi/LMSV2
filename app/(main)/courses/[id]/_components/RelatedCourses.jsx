import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/formatPrice";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/section-title";

const RelatedCourses = ({ relatedCourses }) => {
  return (
    <section>
      <div className="container">
        <SectionTitle className="mb-6">Related Courses</SectionTitle>

        <Carousel
          opts={{ align: "start" }}
          className="max-2xl:w-[90%] w-full mx-auto"
        >
          <CarouselPrevious />
          <CarouselNext />

          <CarouselContent>
            {relatedCourses.map((course) => {
              const thumbnailSrc = course?.thumbnail
                ? `/assets/images/courses/${course.thumbnail}`
                : "/assets/images/courses/default.jpg";

              return (
                <CarouselItem
                  key={course._id}
                  className="md:basis-1/2 lg:basis-1/3"
                >
                  <Link href={`/courses/${course._id.toString()}`}>
                    <div className="group hover:shadow-sm transition overflow-hidden border rounded-lg p-3 h-full">
                      <div className="relative w-full aspect-video rounded-md overflow-hidden">
                        <Image
                          src={thumbnailSrc}
                          alt={course?.title || "Course thumbnail"}
                          className="object-cover"
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      </div>

                      <div className="flex flex-col pt-2">
                        <div className="text-lg md:text-base font-medium group-hover:text-sky-700 line-clamp-2">
                          {course.title}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Development
                        </p>

                        <div className="flex items-center justify-between mt-4">
                          <p className="text-md md:text-sm font-medium text-slate-700">
                            {formatPrice(course.price)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      </div>
    </section>
  );
};

export default RelatedCourses;
