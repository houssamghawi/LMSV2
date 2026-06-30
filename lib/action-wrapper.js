/**
 * Server Action Error Handling Wrapper
 * Wraps server actions to ensure consistent error handling
 */

import { createErrorResponse, createSuccessResponse, getErrorCode, sanitizeErrorMessage, extractZodFieldErrors } from './errors';
import { error as logError, logAction } from './logger';
import { revalidatePath } from 'next/cache';

/**
 * Wrapper for server actions with automatic error handling
 * 
 * @param actionFn - The server action function
 * @param options - Configuration options
 * @returns Wrapped action that returns standardized response
 * 
 * @example
 * export const updateUser = withActionErrorHandling(
 *   async (userId, data) => {
 *     // Your action logic
 *     return { user: updatedUser };
 *   },
 *   { revalidatePaths: ['/account', '/api/me'] }
 * );
 */
export function withActionErrorHandling(
  actionFn,
  options
) {
  const actionName = options?.actionName || actionFn.name || 'unknown-action';
  
  return (async (...args) => {
    const logger = logAction(actionName);
    logger.start();

    try {
      // Execute the action
      const result = await actionFn(...args);
      
      // Revalidate paths if specified
      if (options?.revalidatePaths) {
        options.revalidatePaths.forEach(path => {
          revalidatePath(path);
        });
      }

      // If result is already a standardized response, return it
      if (result && typeof result === 'object' && 'ok' in result) {
        logger.success();
        return result;
      }

      // Wrap result in success response
      logger.success();
      return createSuccessResponse(result);
      
    } catch (err) {
      logger.failure(err instanceof Error ? err : new Error(String(err)));
      
      // Handle Zod validation errors
      if (err && typeof err === 'object' && 'errors' in err) {
        const fieldErrors = extractZodFieldErrors(err);
        return createErrorResponse(
          'Validation failed',
          'VALIDATION_ERROR',
          fieldErrors
        );
      }

      // Handle known error types
      if (err instanceof Error) {
        const errorCode = getErrorCode(err);
        const message = sanitizeErrorMessage(err);
        
        // Check for field errors in message (custom format: "field: message")
        const fieldErrors = {};
        if (message.includes(':')) {
          const parts = message.split(':');
          if (parts.length === 2) {
            fieldErrors[parts[0].trim()] = parts[1].trim();
          }
        }

        return createErrorResponse(
          message,
          errorCode,
          Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined
        );
      }

      // Unknown error
      return createErrorResponse(
        sanitizeErrorMessage(err),
        'INTERNAL_ERROR'
      );
    }
  });
}

/**
 * Helper to extract user ID from session/auth
 * Override this based on your auth setup
 */
export async function getActionUserId() {
  try {
    const { getLoggedInUser } = await import('@/lib/loggedin-user');
    const user = await getLoggedInUser();
    return user?.id || user?.email;
  } catch {
    return undefined;
  }
}

