import { auth } from "@/auth";
import { getCourseDetails } from "@/queries/courses";
import { getUserByEmail } from "@/queries/users";
import { Payment } from "@/model/payment-model";
import { Enrollment } from "@/model/enrollment-model";
import { dbConnect } from "@/service/mongo";
import { Button } from "@/components/ui/button";
import { CircleCheck, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import mongoose from "mongoose";

/**
 * Success page for payments (MockPay)
 * Reads referenceId or paymentId from query params and checks DB
 * No Stripe API calls - uses database as source of truth
 */
async function SuccessContent({ referenceId, paymentId, courseId }) {
  // Authentication check
  const userSession = await auth();
  if (!userSession?.user?.id) {
    redirect("/login");
  }

  const userId = userSession.user.id;

  // Validate we have either referenceId or paymentId
  if (!referenceId && !paymentId) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-[600px] text-center">
        <XCircle className="w-32 h-32 text-destructive" />
        <h1 className="text-xl md:text-2xl lg:text-3xl">
          Invalid Request
        </h1>
        <p className="text-muted-foreground">
          Missing payment reference. Please provide a valid reference ID or payment ID.
        </p>
        <Button asChild size="sm">
          <Link href="/courses">Browse Courses</Link>
        </Button>
      </div>
    );
  }

  // Validate courseId
  if (!courseId) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-[600px] text-center">
        <XCircle className="w-32 h-32 text-destructive" />
        <h1 className="text-xl md:text-2xl lg:text-3xl">
          Invalid Request
        </h1>
        <p className="text-muted-foreground">
          Missing course ID.
        </p>
        <Button asChild size="sm">
          <Link href="/courses">Browse Courses</Link>
        </Button>
      </div>
    );
  }

  // Validate ObjectIds
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-[600px] text-center">
        <XCircle className="w-32 h-32 text-destructive" />
        <h1 className="text-xl md:text-2xl lg:text-3xl">
          Invalid Course ID
        </h1>
        <p className="text-muted-foreground">
          The course ID format is invalid.
        </p>
        <Button asChild size="sm">
          <Link href="/courses">Browse Courses</Link>
        </Button>
      </div>
    );
  }

  // Ensure DB connection
  await dbConnect();

  // Get course details
  const course = await getCourseDetails(courseId);
  const loggedInUser = await getUserByEmail(userSession?.user?.email);

  if (!course) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-[600px] text-center">
        <XCircle className="w-32 h-32 text-destructive" />
        <h1 className="text-xl md:text-2xl lg:text-3xl">
          Course not found
        </h1>
        <Button asChild size="sm">
          <Link href="/courses">Browse Courses</Link>
        </Button>
      </div>
    );
  }

  // Find payment record - support both referenceId (MockPay) and paymentId
  let payment = null;
  try {
    if (referenceId) {
      // MockPay: find by referenceId
      payment = await Payment.findOne({ referenceId, provider: 'mockpay' }).lean();
    } else if (paymentId && mongoose.Types.ObjectId.isValid(paymentId)) {
      // Generic: find by paymentId
      payment = await Payment.findById(paymentId).lean();
    }
  } catch (error) {
    console.error('Error finding payment:', error);
    // Continue to show error state
  }

  if (!payment) {
    return (
      <div className="h-full w-full flex-1 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-[600px] text-center">
          <Loader2 className="w-32 h-32 animate-spin text-primary" />
          <h1 className="text-xl md:text-2xl lg:text-3xl">
            Payment Not Found
          </h1>
          <p className="text-muted-foreground">
            We couldn't find your payment record. This may happen if the payment is still being processed.
          </p>
          <p className="text-sm text-muted-foreground">
            If you just completed a payment, please wait a moment and refresh the page.
          </p>
          <div className="flex items-center gap-3">
            <Button asChild size="sm">
              <Link href="/courses">Browse Courses</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/enroll-success?referenceId=${referenceId || ''}&courseId=${courseId}`}>Refresh</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Verify payment belongs to current user
  const paymentUserId = payment.user?.toString() || payment.user;
  if (paymentUserId !== userId) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-[600px] text-center">
        <XCircle className="w-32 h-32 text-destructive" />
        <h1 className="text-xl md:text-2xl lg:text-3xl">
          Access Denied
        </h1>
        <p className="text-muted-foreground">
          This payment does not belong to your account.
        </p>
        <Button asChild size="sm">
          <Link href="/courses">Browse Courses</Link>
        </Button>
      </div>
    );
  }

  // Check payment status
  const isPaid = payment.status === 'succeeded';
  const isFailed = payment.status === 'failed';
  const isPending = payment.status === 'pending';

  // Get user and course IDs from payment
  const paymentUserIdObj = payment.user instanceof mongoose.Types.ObjectId
    ? payment.user
    : new mongoose.Types.ObjectId(payment.user);
  const paymentCourseIdObj = payment.course instanceof mongoose.Types.ObjectId
    ? payment.course
    : new mongoose.Types.ObjectId(payment.course);

  // Check enrollment - use direct query (fast)
  let enrollment = null;
  try {
    enrollment = await Enrollment.findOne({
      student: paymentUserIdObj,
      course: paymentCourseIdObj
    }).lean();
  } catch (error) {
    console.error('Error finding enrollment:', error);
  }

  const isEnrolled = !!enrollment;

  const customerName = `${loggedInUser?.firstName || ''} ${loggedInUser?.lastName || ''}`.trim() || 'Student';
  const productName = course?.title || 'Course';

  // Failed payment
  if (isFailed) {
    return (
      <div className="h-full w-full flex-1 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-[600px] text-center">
          <XCircle className="w-32 h-32 text-destructive" />
          <h1 className="text-xl md:text-2xl lg:text-3xl">
            Payment Failed
          </h1>
          <p className="text-muted-foreground">
            Your payment could not be processed. Please try again.
          </p>
          <div className="flex items-center gap-3">
            <Button asChild size="sm">
              <Link href="/courses">Browse Courses</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/checkout/mock?courseId=${courseId}`}>Try Again</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Pending payment
  if (isPending) {
    return (
      <div className="h-full w-full flex-1 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-[600px] text-center">
          <Loader2 className="w-32 h-32 animate-spin text-primary" />
          <h1 className="text-xl md:text-2xl lg:text-3xl">
            Payment Pending
          </h1>
          <p className="text-muted-foreground">
            Your payment is being processed. Please wait...
          </p>
          <Button asChild size="sm">
            <Link href="/courses">Browse Courses</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Payment succeeded but enrollment pending (shouldn't happen with MockPay, but handle gracefully)
  if (isPaid && !isEnrolled) {
    return (
      <div className="h-full w-full flex-1 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-[600px] text-center">
          <Loader2 className="w-32 h-32 animate-spin text-primary" />
          <h1 className="text-xl md:text-2xl lg:text-3xl">
            Setting Up Enrollment
          </h1>
          <p className="text-muted-foreground">
            Your payment was successful. We're setting up your enrollment. Please wait a moment...
          </p>
          <p className="text-sm text-muted-foreground">
            If this message persists, please refresh the page or contact support.
          </p>
          <div className="flex items-center gap-3">
            <Button asChild size="sm">
              <Link href="/courses">Browse Courses</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/enroll-success?referenceId=${referenceId || ''}&courseId=${courseId}`}>Refresh</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success!
  if (isPaid && isEnrolled) {
    return (
      <div className="h-full w-full flex-1 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-[600px] text-center">
          <CircleCheck className="w-32 h-32 bg-green-500 rounded-full p-0 text-white" />
          <h1 className="text-xl md:text-2xl lg:text-3xl">
            Congratulations! <strong>{customerName}</strong> Your Enrollment was Successful for <strong>{productName}</strong>
          </h1>
          <p className="text-muted-foreground">
            You can now access all course content.
          </p>
          <div className="flex items-center gap-3">
            <Button asChild size="sm">
              <Link href="/courses">Browse Courses</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/courses/${courseId}/lesson`}>Start Learning</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Default fallback state
  return (
    <div className="h-full w-full flex-1 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-6 max-w-[600px] text-center">
        <Loader2 className="w-32 h-32 animate-spin text-primary" />
        <h1 className="text-xl md:text-2xl lg:text-3xl">
          Processing
        </h1>
        <p className="text-muted-foreground">
          Please wait while we process your request...
        </p>
      </div>
    </div>
  );
}

const Success = async ({ searchParams }) => {
  const params = await searchParams;
  const referenceId = params.referenceId;
  const paymentId = params.paymentId;
  const courseId = params.courseId;

  return (
    <Suspense fallback={
      <div className="h-full w-full flex-1 flex flex-col items-center justify-center">
        <Loader2 className="w-32 h-32 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    }>
      <SuccessContent referenceId={referenceId} paymentId={paymentId} courseId={courseId} />
    </Suspense>
  );
};

export default Success;
