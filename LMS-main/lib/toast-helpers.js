/**
 * Toast Helper Functions
 * Centralized toast notifications using Sonner
 * 
 * Usage in client components:
 * import { toastSuccess, toastError, toastInfo, toastWarning } from '@/lib/toast-helpers';
 */

"use client";

import { toast as sonnerToast } from "sonner";

/**
 * Show success toast
 */
export function toastSuccess(message, description) {
  sonnerToast.success(message, {
    description,
    duration: 4000,
  });
}

/**
 * Show error toast
 */
export function toastError(message, description) {
  sonnerToast.error(message, {
    description,
    duration: 5000,
  });
}

/**
 * Show info toast
 */
export function toastInfo(message, description) {
  sonnerToast.info(message, {
    description,
    duration: 4000,
  });
}

/**
 * Show warning toast
 */
export function toastWarning(message, description) {
  sonnerToast.warning(message, {
    description,
    duration: 4000,
  });
}

/**
 * Handle server action response and show appropriate toast
 * 
 * @example
 * const result = await updateUser(data);
 * handleActionResponse(result, {
 *   onSuccess: () => router.refresh(),
 *   onError: (fieldErrors) => {
 *     // Handle field errors
 *   }
 * });
 */
export function handleActionResponse(
  response,
  options
) {
  const { onSuccess, onError, showToast = true } = options || {};

  if (response.ok) {
    if (showToast) {
      toastSuccess(response.message);
    }
    onSuccess?.();
  } else {
    if (showToast) {
      if (response.fieldErrors && Object.keys(response.fieldErrors).length > 0) {
        // Show field errors
        const firstError = Object.values(response.fieldErrors)[0];
        toastError(response.message || 'Validation failed', firstError);
      } else {
        toastError(response.message || 'An error occurred');
      }
    }
    onError?.(response.fieldErrors);
  }

  return response;
}

/**
 * Show field validation errors
 */
export function showFieldErrors(fieldErrors) {
  Object.entries(fieldErrors).forEach(([field, message]) => {
    toastError(`Validation error: ${field}`, message);
  });
}

