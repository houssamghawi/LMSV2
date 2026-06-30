import { unstable_cache } from "next/cache";
import { SectionTitle } from "@/components/section-title";
import Support from "@/components/support";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getFeaturedCourses, getCourseStats } from "@/queries/courses";
import { ArrowRightIcon, BookOpen, Users, Award, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import CourseCard from "./courses/_components/CourseCard";
import { getCategories } from "@/queries/categories";
import { getFeaturedTestimonials } from "@/queries/testimonials";
import { auth } from "@/auth";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { getEnrollmentsForUser } from "@/queries/enrollments";
import { getCourseDetailsByInstructor } from "@/queries/courses";
import Element from "@/components/element";
import { SafeImage } from "@/components/safe-image";

// SEO Metadata
export const metadata = {
  title: "Easy Learning Academy - Best Online Professional Courses",
  description: "Learn by doing with Easy Learning Academy. Access thousands of professional courses, learn from expert instructors, and advance your career. Join thousands of students already learning.",
  keywords: ["online courses", "professional training", "learn programming", "online education", "skill development"],
  openGraph: {
    title: "Easy Learning Academy - Best Online Professional Courses",
    description: "Learn by doing with Easy Learning Academy. Access thousands of professional courses.",
    type: "website",
  },
};

// Cache data fetching for performance
const getCachedFeaturedCourses = unstable_cache(
  async () => {
    return await getFeaturedCourses(8);
  },
  ['featured-courses'],
  { revalidate: 3600 } // Revalidate every hour
);

const getCachedCategories = unstable_cache(
  async () => {
    return await getCategories();
  },
  ['categories'],
  { revalidate: 3600 }
);

const getCachedStats = unstable_cache(
  async () => {
    return await getCourseStats();
  },
  ['course-stats'],
  { revalidate: 1800 } // Revalidate every 30 minutes
);

const getCachedTestimonials = unstable_cache(
  async () => {
    return await getFeaturedTestimonials(6);
  },
  ['featured-testimonials'],
  { revalidate: 3600 }
);

const HomePage = async () => {
  try {
    // Get session for role-based content
    const session = await auth();
    const user = session?.user ? await getLoggedInUser() : null;
    
    // Fetch data in parallel for better performance
    const [featuredCourses, categories, stats, testimonials] = await Promise.all([
      getCachedFeaturedCourses(),
      getCachedCategories(),
      getCachedStats(),
      getCachedTestimonials()
    ]);

    // Get user-specific data if logged in
    let userEnrollments = [];
    let instructorCourses = [];
    
    if (user) {
      if (user.role === 'student') {
        userEnrollments = await getEnrollmentsForUser(user.id);
        // Limit to 3 most recent
        userEnrollments = userEnrollments.slice(0, 3);
      } else if (user.role === 'instructor') {
        const instructorData = await getCourseDetailsByInstructor(user.id, false);
        instructorCourses = instructorData?.inscourses || [];
      }
    }

    // Determine hero CTA based on user role
    const getHeroCTAs = () => {
      if (!user) {
        return (
          <>
            <Link href="/courses" className={cn(buttonVariants({ size: "lg" }))}>
              Browse Courses
            </Link>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              Sign In
            </Link>
          </>
        );
      }
      
      if (user.role === 'student') {
        return (
          <>
            <Link href="/courses" className={cn(buttonVariants({ size: "lg" }))}>
              Continue Learning
            </Link>
            <Link href="/account/enrolled-courses" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              My Courses
            </Link>
          </>
        );
      }
      
      if (user.role === 'instructor') {
        return (
          <>
            <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }))}>
              Instructor Dashboard
            </Link>
            <Link href="/dashboard/courses/add" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              Create Course
            </Link>
          </>
        );
      }
      
      return (
        <>
          <Link href="/courses" className={cn(buttonVariants({ size: "lg" }))}>
            Browse Courses
          </Link>
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Dashboard
          </Link>
        </>
      );
    };

    return (
      <>
        {/* Hero Section */}
        <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32 grainy">
          <div className="container flex max-w-[64rem] flex-col items-center gap-4 text-center relative isolate">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
            >
              <div
                style={{
                  clipPath:
                    "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
                }}
                className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
              />
            </div>
            <span className="rounded-2xl bg-muted px-4 py-1.5 text-sm font-medium border shadow-lg">
              {user ? `Welcome back, ${user.firstName}!` : "Hey, Welcome"}
            </span>
            <h1 className="font-heading text-3xl font-bold sm:text-5xl md:text-6xl lg:text-7xl">
              Learn By Doing with <br/> Easy Learning
            </h1>
            <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
              {user?.role === 'student' 
                ? "Continue your learning journey and master new skills."
                : user?.role === 'instructor'
                ? "Share your knowledge and help students achieve their goals."
                : "You don't understand anything until you learn it more than one way."
              }
            </p>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {getHeroCTAs()}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="container py-8 md:py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="text-center p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-center mb-2">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <div className="text-2xl md:text-3xl font-bold">{stats.totalCourses}</div>
              <div className="text-sm text-muted-foreground">Courses</div>
            </div>
            <div className="text-center p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-center mb-2">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div className="text-2xl md:text-3xl font-bold">{stats.totalEnrollments}</div>
              <div className="text-sm text-muted-foreground">Students</div>
            </div>
            <div className="text-center p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-center mb-2">
                <Award className="h-8 w-8 text-primary" />
              </div>
              <div className="text-2xl md:text-3xl font-bold">{stats.totalInstructors}</div>
              <div className="text-sm text-muted-foreground">Instructors</div>
            </div>
            <div className="text-center p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <div className="text-2xl md:text-3xl font-bold">{stats.totalCategories}</div>
              <div className="text-sm text-muted-foreground">Categories</div>
            </div>
          </div>
        </section>

        {/* User-specific sections */}
        {user?.role === 'student' && userEnrollments.length > 0 && (
          <section className="container space-y-6 py-8 md:py-12">
            <div className="flex items-center justify-between">
              <SectionTitle>Continue Learning</SectionTitle>
              <Link
                href="/account/enrolled-courses"
                className="text-sm font-medium hover:opacity-80 flex items-center gap-1"
              >
                View All <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {userEnrollments.map((enrollment) => {
                if (!enrollment.course) return null;
                return (
                  <CourseCard key={enrollment.course.id || enrollment.course._id} course={enrollment.course} />
                );
              })}
            </div>
          </section>
        )}

        {user?.role === 'instructor' && instructorCourses.length > 0 && (
          <section className="container space-y-6 py-8 md:py-12">
            <div className="flex items-center justify-between">
              <SectionTitle>Your Courses</SectionTitle>
              <Link
                href="/dashboard/courses"
                className="text-sm font-medium hover:opacity-80 flex items-center gap-1"
              >
                Manage All <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {instructorCourses.slice(0, 4).map((course) => (
                <CourseCard key={course.id || course._id} course={course} />
              ))}
            </div>
          </section>
        )}

        {/* How It Works Section */}
        <Element/>

        {/* Categories Section */}
        {categories && categories.length > 0 && (
          <section
            id="categories"
            className="container space-y-6 py-8 md:py-12 lg:py-24"
          >
            <div className="flex items-center justify-between">
              <SectionTitle>Browse by Category</SectionTitle>
              <Link
                href="/courses"
                className="text-sm font-medium hover:opacity-80 flex items-center gap-1"
              >
                Browse All <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            <div className="mx-auto grid justify-center gap-4 grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
              {categories.slice(0, 8).map((category) => (
                <Link
                  href={`/categories/${category.id}`}
                  key={category.id}
                  className="relative overflow-hidden rounded-lg border bg-background p-2 hover:scale-105 transition-all duration-300 ease-in-out"
                >
                  <div className="flex flex-col gap-4 items-center justify-between rounded-md p-6">
                    <Image
                      src={`/assets/images/categories/${category.thumbnail}`}
                      alt={category.title}
                      width={100}
                      height={100}
                      className="object-contain"
                    />
                    <h3 className="font-bold text-center">{category.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Featured Courses */}
        {featuredCourses && featuredCourses.length > 0 && (
          <section id="courses" className="container space-y-6 py-8 md:py-12 lg:py-24">
            <div className="flex items-center justify-between">
              <SectionTitle>Featured Courses</SectionTitle>
              <Link
                href="/courses"
                className="text-sm font-medium hover:opacity-80 flex items-center gap-1"
              >
                Browse All <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {featuredCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </section>
        )}

        {/* Testimonials Section */}
        {testimonials && testimonials.length > 0 && (
          <section className="container space-y-6 py-8 md:py-12 lg:py-24">
            <div className="text-center space-y-2">
              <SectionTitle>What Students Say</SectionTitle>
              <p className="text-muted-foreground">Hear from our community of learners</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((testimonial) => (
                <div
                  key={testimonial.id}
                  className="p-6 rounded-lg border bg-background shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className={i < (testimonial.rating || 0) ? "text-yellow-400" : "text-gray-300"}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-4">
                    "{testimonial.content}"
                  </p>
                  <div className="flex items-center gap-3">
                    <SafeImage
                      src={testimonial.user?.profilePicture}
                      alt={testimonial.user?.firstName || "Student"}
                      width={40}
                      height={40}
                      className="rounded-full"
                      fallback="/assets/images/profile.jpg"
                    />
                    <div>
                      <div className="font-semibold text-sm">
                        {testimonial.user?.firstName || "Student"} {testimonial.user?.lastName || ""}
                      </div>
                      {testimonial.courseId && testimonial.courseId.title && (
                        <div className="text-xs text-muted-foreground">
                          {testimonial.courseId.title}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Support Section */}
        <Support/>
      </>
    );
  } catch (error) {
    console.error('Home page error:', error);
    // Return a basic error state
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
        <p className="text-muted-foreground mb-6">
          We're having trouble loading the page. Please try again later.
        </p>
        <Link href="/courses" className={cn(buttonVariants())}>
          Browse Courses
        </Link>
      </div>
    );
  }
};

export default HomePage;
