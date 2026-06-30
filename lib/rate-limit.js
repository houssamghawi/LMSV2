// Simple in-memory rate limiter
// For production, consider using Redis or a dedicated service like Upstash

const rateLimitMap = new Map();

export function rateLimit(identifier, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const key = identifier;
  
  const record = rateLimitMap.get(key);
  
  if (!record) {
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    return { success: true, remaining: maxRequests - 1 };
  }
  
  // Reset if window has passed
  if (now > record.resetTime) {
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    return { success: true, remaining: maxRequests - 1 };
  }
  
  // Increment count
  record.count++;
  
  if (record.count > maxRequests) {
    return { 
      success: false, 
      remaining: 0,
      resetTime: record.resetTime
    };
  }
  
  return { 
    success: true, 
    remaining: maxRequests - record.count 
  };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000); // Clean up every minute

