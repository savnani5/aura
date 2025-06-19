import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  '/meetingroom/(.*)',
  '/meeting/(.*)',
  '/api/tasks(.*)',                    // Task management APIs require auth
  '/api/meetings$',                    // General meetings list endpoint  
  '/api/meetings/(.*)',                // All meeting-related APIs (we'll exclude specific ones below)
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
]);

export default clerkMiddleware(async (auth, request) => {
  // Check if route is explicitly public first
  if (isPublicRoute(request)) {
    return;
  }
  
  // Then check if route is protected and requires auth
  if (isProtectedRoute(request)) {
    const { userId } = await auth();
    if (!userId) {
      return (await auth()).redirectToSignIn();
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}; 