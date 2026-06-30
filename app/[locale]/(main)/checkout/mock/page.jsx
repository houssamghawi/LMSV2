import Image from "next/image";
import { auth } from "@/auth";
import { getCourseDetails } from "@/queries/courses";
import { getUserByEmail } from "@/queries/users";
import { hasEnrollmentForCourse } from "@/queries/enrollments";
import { redirect } from "next/navigation";
import { CheckoutForm } from "./_components/checkout-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard } from "lucide-react";
import Link from "next/link";
import { getSafeImagePath } from "@/lib/utils";

export default async function MockCheckoutPage({ searchParams }) {
  const params = await searchParams;
  const courseId = params.courseId;

  // Authentication check
  const session = await auth();
  if (!session?.user?.id) {
    const callbackUrl = encodeURIComponent(`/checkout/mock?courseId=${courseId}`);
    redirect(`/login?callbackUrl=${callbackUrl}`);
  }

  const userId = session.user.id;
  const user = await getUserByEmail(session.user.email);

  // Validate courseId
  if (!courseId) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Invalid Request</h2>
              <p className="text-muted-foreground mb-4">No course specified.</p>
              <Button asChild>
                <Link href="/courses">Browse Courses</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get course details
  const course = await getCourseDetails(courseId);
  if (!course) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Course Not Found</h2>
              <p className="text-muted-foreground mb-4">The course you're looking for doesn't exist.</p>
              <Button asChild>
                <Link href="/courses">Browse Courses</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if already enrolled
  const alreadyEnrolled = await hasEnrollmentForCourse(courseId, userId);
  if (alreadyEnrolled) {
    redirect(`/courses/${courseId}`);
  }

  // Check if course is free
  const coursePrice = course.price || 0;
  if (coursePrice === 0) {
    // Free course - redirect to direct enrollment
    redirect(`/courses/${courseId}`);
  }

  // Check if course is active
  if (!course.active) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Course Not Available</h2>
              <p className="text-muted-foreground mb-4">This course is not available for purchase.</p>
              <Button asChild>
                <Link href="/courses">Browse Courses</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href={`/courses/${courseId}`}>
            <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" />
            Back to Course
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Course Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Course Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{course.title}</h3>
              {course.subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{course.subtitle}</p>
              )}
            </div>
            
            <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
              <Image
                src={getSafeImagePath(course.thumbnail)}
                alt={course.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-bold">${coursePrice.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Checkout Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment (Simulated)
            </CardTitle>
            <CardDescription>
              This is a demo payment system. No real charges will be made.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CheckoutForm 
              courseId={courseId}
              coursePrice={coursePrice}
              courseTitle={course.title}
              userId={userId}
              userEmail={user?.email || ''}
              userName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User'}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

