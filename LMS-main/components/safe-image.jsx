"use client";

import Image from "next/image";
import { useState, useCallback } from "react";
import { getSafeImageUrl, shouldUseUnoptimized } from "@/lib/image-utils";

/**
 * Safe Image component that handles errors and external images.
 * Pass sizes when possible for responsive loading (e.g. sizes="(max-width: 768px) 100px, 40px").
 */
export function SafeImage({ src, alt, fallback = "/assets/images/profile.jpg", ...props }) {
  const [imgSrc, setImgSrc] = useState(() => getSafeImageUrl(src, fallback));
  const useUnoptimized = shouldUseUnoptimized(src);

  const handleError = useCallback(() => {
    setImgSrc((current) => (current !== fallback ? fallback : current));
  }, [fallback]);

  return (
    <Image
      src={imgSrc}
      alt={alt}
      unoptimized={useUnoptimized}
      onError={handleError}
      {...props}
    />
  );
}

