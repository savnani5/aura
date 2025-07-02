import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define protected routes that require subscription
const isProtectedRoute = createRouteMatcher([
  '/((?!api|_next/static|_next/image|favicon.ico|images|subscription|sign-in|sign-up|$).*)',
]);

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/rooms/(.*)',                       // Allow guest access to live meeting rooms
  '/api/connection-details(.*)',       // LiveKit connection details
  '/api/meetings/start',               // Allow guests to start/join meetings
  '/api/meetings/(.*)/end',            // Allow guests to end meetings
  '/api/meetings/(.*)/history',        // Allow access to meeting history (for AI context)
  '/api/ai-chat',                      // Allow AI chat for live meetings
  '/api/webhooks/(.*)',                // Exclude all webhook routes from Clerk middleware
]);

// Define webhook routes that should bypass all middleware processing
const isWebhookRoute = createRouteMatcher([
  '/api/webhooks/(.*)',
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Skip all processing for webhook routes to prevent redirects
  if (isWebhookRoute(req)) {
    return NextResponse.next();
  }

  const { userId } = await auth();
  
  // If user is signed in and trying to access protected routes
  if (isProtectedRoute(req) && userId) {
    // Skip subscription check for subscription-related pages
    if (req.nextUrl.pathname.startsWith('/subscription')) {
      return NextResponse.next();
    }

    try {
      // For now, let's use a simpler approach and check subscription client-side
      // The subscription page itself will handle the redirect logic
      return NextResponse.next();
    } catch (error) {
      console.error('Error in middleware:', error);
      return NextResponse.next();
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}; 