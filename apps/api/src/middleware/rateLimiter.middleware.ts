import rateLimit from 'express-rate-limit';

export const standardRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://tools.ietf.org/html/rfc7807#section-3.1',
    title: 'Too Many Requests',
    status: 429,
    code: 'RATE_LIMIT_EXCEEDED',
    detail: 'Too many requests from this IP, please try again after 15 minutes.',
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 login attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://tools.ietf.org/html/rfc7807#section-3.1',
    title: 'Too Many Authentication Attempts',
    status: 429,
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    detail: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
  },
});
