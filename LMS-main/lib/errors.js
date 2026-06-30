/**
 * Standardized Error Handling System
 * Single source of truth for error shapes and codes
 */

// Error codes for client-side handling
export const ERROR_CODES = {
  // Authentication & Authorization
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  
  // Rate Limiting
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Server Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Business Logic
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  OPERATION_FAILED: 'OPERATION_FAILED',
};

/**
 * Standard Server Action Response Shape
 * All server actions should return this shape:
 * { ok: boolean, message: string, errorCode?: string, fieldErrors?: Record<string, string>, data?: any }
 */

/**
 * Standard API Route Error Response
 * All API routes should return this shape for errors:
 * { message: string, errorCode?: string, details?: Record<string, any> }
 */

/**
 * Create a success response for server actions
 */
export function createSuccessResponse(data, message = 'Operation successful') {
  return {
    ok: true,
    message,
    data,
  };
}

/**
 * Create an error response for server actions
 */
export function createErrorResponse(
  message,
  errorCode,
  fieldErrors
) {
  return {
    ok: false,
    message,
    errorCode: errorCode || ERROR_CODES.OPERATION_FAILED,
    fieldErrors,
  };
}

/**
 * Create validation error response with field-level errors
 */
export function createValidationErrorResponse(
  fieldErrors,
  message = 'Validation failed'
) {
  return {
    ok: false,
    message,
    errorCode: ERROR_CODES.VALIDATION_ERROR,
    fieldErrors,
  };
}

/**
 * Create API error response (for route handlers)
 */
export function createApiErrorResponse(
  message,
  status,
  errorCode,
  details
) {
  const data = {
    message,
    errorCode: errorCode || ERROR_CODES.INTERNAL_ERROR,
  };

  // Only include details in development
  if (process.env.NODE_ENV === 'development' && details) {
    data.details = details;
  }

  return {
    response: new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
    data,
  };
}

/**
 * Map error to appropriate error code
 */
export function getErrorCode(error) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('unauthorized') || message.includes('not authenticated')) {
      return ERROR_CODES.AUTH_REQUIRED;
    }
    if (message.includes('forbidden') || message.includes('permission denied')) {
      return ERROR_CODES.FORBIDDEN;
    }
    if (message.includes('not found')) {
      return ERROR_CODES.NOT_FOUND;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ERROR_CODES.VALIDATION_ERROR;
    }
    if (message.includes('already exists') || message.includes('duplicate')) {
      return ERROR_CODES.ALREADY_EXISTS;
    }
    if (message.includes('rate limit') || message.includes('too many')) {
      return ERROR_CODES.RATE_LIMITED;
    }
    if (message.includes('database') || message.includes('mongodb') || message.includes('mongoose')) {
      return ERROR_CODES.DATABASE_ERROR;
    }
  }
  
  return ERROR_CODES.INTERNAL_ERROR;
}

/**
 * Sanitize error message for client (remove sensitive info)
 */
export function sanitizeErrorMessage(error, defaultMessage = 'An error occurred') {
  if (error instanceof Error) {
    let message = error.message;
    
    // Remove stack traces
    message = message.split('\n')[0];
    
    // Remove sensitive patterns (adjust as needed)
    message = message.replace(/password|token|secret|key/gi, '[REDACTED]');
    
    // Remove internal error details in production
    if (process.env.NODE_ENV === 'production') {
      if (message.includes('MongoError') || message.includes('MongooseError')) {
        return 'Database operation failed. Please try again.';
      }
      if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
        return 'Service temporarily unavailable. Please try again later.';
      }
    }
    
    return message || defaultMessage;
  }
  
  return defaultMessage;
}

/**
 * Extract field errors from Zod validation errors
 */
export function extractZodFieldErrors(zodError) {
  if (!zodError?.errors || !Array.isArray(zodError.errors)) {
    return {};
  }

  const fieldErrors = {};
  
  zodError.errors.forEach((error) => {
    const path = error.path?.join('.') || 'root';
    fieldErrors[path] = error.message || 'Invalid value';
  });

  return fieldErrors;
}

