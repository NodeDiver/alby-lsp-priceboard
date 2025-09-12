import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? Redis.fromEnv()
  : null;

const limiter = redis ? new Ratelimit({ 
  redis, 
  limiter: Ratelimit.slidingWindow(60, '1 m') // 60 requests per minute
}) : null;

export async function middleware(req: Request) {
  const url = new URL(req.url);
  
  // Only apply rate limiting to /api/prices
  if (url.pathname !== '/api/prices' || !limiter) {
    return NextResponse.next();
  }

  // Get client IP (considering proxies)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             req.headers.get('x-real-ip') || 
             'global';

  try {
    const { success, reset } = await limiter.limit(ip);
    
    if (success) {
      return NextResponse.next();
    }

    // Rate limit exceeded
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    const res = NextResponse.json({ 
      success: false, 
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retry_after: retryAfter
    }, { status: 429 });
    
    res.headers.set('Retry-After', retryAfter.toString());
    return res;
  } catch (error) {
    // If rate limiting fails, allow the request through
    console.error('Rate limiting error:', error);
    return NextResponse.next();
  }
}

export const config = { 
  matcher: ['/api/prices'] 
};
