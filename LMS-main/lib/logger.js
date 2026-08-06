/**
 * Production-friendly logging utility
 * Replaces console.log/error with structured logging
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const CURRENT_LOG_LEVEL = process.env.NODE_ENV === 'production' 
  ? LOG_LEVELS.INFO 
  : LOG_LEVELS.DEBUG;

/**
 * Log context (route/action name, userId, etc.)
 * Shape: { route?: string, action?: string, userId?: string, [key: string]: any }
 */

/**
 * Base logger function
 */
function log(level, message, context, error) {
  if (LOG_LEVELS[level] < CURRENT_LOG_LEVEL) {
    return;
  }

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(context && { context }),
    ...(error && {
      error: {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    }),
  };

  // In production, you might want to send this to a logging service
  // For now, we'll use console with structured format
  const logMethod = level === 'ERROR' ? console.error : 
                    level === 'WARN' ? console.warn :
                    level === 'DEBUG' ? console.debug : 
                    console.log;

  logMethod(JSON.stringify(logEntry));
}

/**
 * Debug log (development only)
 */
export function debug(message, context) {
  log('DEBUG', message, context);
}

/**
 * Info log
 */
export function info(message, context) {
  log('INFO', message, context);
}

/**
 * Warning log
 */
export function warn(message, context) {
  log('WARN', message, context);
}

/**
 * Error log
 */
export function error(message, error, context) {
  log('ERROR', message, context, error);
}

/**
 * Log server action execution
 */
export function logAction(actionName, userId, additionalContext) {
  return {
    start: () => {
      debug(`Action started: ${actionName}`, {
        action: actionName,
        userId,
        ...additionalContext,
      });
    },
    success: (data) => {
      info(`Action succeeded: ${actionName}`, {
        action: actionName,
        userId,
        ...additionalContext,
      });
      return data;
    },
    failure: (err) => {
      error(`Action failed: ${actionName}`, err, {
        action: actionName,
        userId,
        ...additionalContext,
      });
      throw err;
    },
  };
}

/**
 * Log API route execution
 */
export function logRoute(route, method, userId) {
  return {
    start: () => {
      debug(`${method} ${route}`, {
        route,
        method,
        userId,
      });
    },
    success: (status) => {
      info(`${method} ${route} - ${status}`, {
        route,
        method,
        userId,
        status,
      });
    },
    failure: (err, status) => {
      error(`${method} ${route} - ${status}`, err, {
        route,
        method,
        userId,
        status,
      });
    },
  };
}

/**
 * Note: For production, integrate with Sentry or similar:
 * 
 * import * as Sentry from '@sentry/nextjs';
 * 
 * export function error(message: string, error?: Error, context?: LogContext) {
 *   log('ERROR', message, context, error);
 *   if (error) {
 *     Sentry.captureException(error, { extra: context });
 *   }
 * }
 */

