"use client";

import dynamic from "next/dynamic";
import { LessonVideoLoading } from "./lesson-video-loading";

/**
 * Client wrapper so we can use ssr: false with next/dynamic.
 * LessonVideo uses ReactPlayer and window — ssr: false avoids hydration errors.
 */
const LessonVideo = dynamic(
  () => import("./lesson-video").then((m) => m.LessonVideo),
  {
    ssr: false,
    loading: () => <LessonVideoLoading />,
  }
);

export function LessonVideoWrapper(props) {
  return <LessonVideo {...props} />;
}
