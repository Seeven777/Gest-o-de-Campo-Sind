import { createNeonAuth } from '@neondatabase/auth/next/server';
export const auth = createNeonAuth({
  baseUrl: (process.env.DATABASE_NEON_AUTH_BASE_URL || process.env.NEON_AUTH_BASE_URL)!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});
