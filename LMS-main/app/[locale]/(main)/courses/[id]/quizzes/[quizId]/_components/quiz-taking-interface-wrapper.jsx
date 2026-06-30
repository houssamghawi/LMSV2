"use client";

import dynamic from "next/dynamic";

/**
 * Client wrapper so we can use ssr: false with next/dynamic.
 * Quiz UI uses client-only APIs (timer, forms) — ssr: false avoids hydration mismatch.
 */
const QuizTakingInterface = dynamic(
  () => import("./quiz-taking-interface").then((m) => m.QuizTakingInterface),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-slate-600">Loading quiz...</p>
        </div>
      </div>
    ),
  }
);

export function QuizTakingInterfaceWrapper(props) {
  return <QuizTakingInterface {...props} />;
}
