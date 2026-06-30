/**
 * Get a safe image URL with fallback
 * @param {string} imageUrl - The image URL to use
 * @param {string} fallback - Fallback image path (default: local profile image)
 * @returns {string} Safe image URL
 */
export function getSafeImageUrl(imageUrl, fallback = '/assets/images/profile.jpg') {
  if (!imageUrl || imageUrl.trim() === '') {
    return fallback;
  }
  
  // If it's a local path, return as is
  if (imageUrl.startsWith('/')) {
    return imageUrl;
  }
  
  // If it's an external URL that might timeout, we'll handle it in the component
  // For now, return the URL but components should use unoptimized for external images
  return imageUrl;
}

/**
 * Check if image URL is external
 * @param {string} url - Image URL
 * @returns {boolean}
 */
export function isExternalImage(url) {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Check if image should use unoptimized (for problematic external sources)
 * @param {string} url - Image URL
 * @returns {boolean}
 */
export function shouldUseUnoptimized(url) {
  if (!url) return false;
  // Use unoptimized for pravatar and other potentially slow external sources
  return url.includes('pravatar.cc') || url.includes('i.pravatar.cc');
}

