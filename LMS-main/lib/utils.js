import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Safely constructs an image path for Next.js Image component
 * Handles various formats: filename, relative path, absolute URL
 * @param {string} imagePath - The image path from database (filename, relative path, or URL)
 * @param {string} basePath - The base path to prepend (default: '/assets/images/courses')
 * @param {string} defaultImage - Fallback image path (default: '/assets/images/courses/default.jpg')
 * @returns {string} A valid image path starting with '/' or 'http://' or 'https://'
 */
export function getSafeImagePath(imagePath, basePath = '/assets/images/courses', defaultImage = '/assets/images/courses/default.jpg') {
  // Return default if no image path provided
  if (!imagePath || typeof imagePath !== 'string' || imagePath.trim() === '') {
    return defaultImage;
  }

  const trimmedPath = imagePath.trim();

  // If already an absolute URL or starts with /, use as-is
  if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://') || trimmedPath.startsWith('/')) {
    return trimmedPath;
  }

  // Otherwise, prepend the base path
  return `${basePath}/${trimmedPath}`;
}
