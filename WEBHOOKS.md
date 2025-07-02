# Webhook Configuration Guide

This document explains how webhooks are configured in the Ohm application for both Clerk (authentication) and Stripe (payments).

## Important Concepts

1. **Webhook Signature Verification**: Both Clerk and Stripe sign their webhook payloads to ensure they are legitimate. This requires preserving the exact raw request body.

2. **No Redirects**: Webhook URLs must not redirect, as this breaks signature verification. The raw request needs to reach the handler directly.

3. **Development vs. Production**: The app has special handling for development environments to make testing easier.

## Configuration Files

### 1. Middleware (`middleware.ts`)

The middleware is configured to:
- Detect webhook routes using `isWebhookRoute` matcher
- Bypass Clerk authentication for webhook endpoints
- Prevent any redirects for webhook paths

### 2. Vercel Configuration (`vercel.json`)

The Vercel config ensures:
- No redirects occur for webhook endpoints
- Proper headers are set
- Trailing slashes are standardized

### 3. Webhook Handlers

Both webhook handlers (`/app/api/webhooks/clerk/route.ts` and `/app/api/webhooks/stripe/route.ts`):
- Use `runtime = 'nodejs'` to preserve raw request bodies
- Use `dynamic = 'force-dynamic'` to prevent caching
- Handle signature verification
- Have special handling for development environments

## Environment Variables

Required environment variables:
- `CLERK_WEBHOOK_SECRET`: Secret for verifying Clerk webhooks
- `STRIPE_WEBHOOK_SECRET`: Secret for verifying Stripe webhooks

Optional development variables:
- `CLERK_SKIP_VERIFICATION=true`: Skip signature verification in development
- `CLERK_DEV_MODE=true`: Force development mode for Clerk

## Testing Webhooks

1. **Verification Script**: Use `node verify-clerk-webhook.js` to test the Clerk webhook handler.

2. **Local Development**:
   - Use `ngrok` or similar tool to expose your local server
   - Configure webhook endpoints in Clerk/Stripe dashboards to point to your tunnel
   - Set the webhook secrets in your environment variables

3. **Debug Logs**: The webhook handlers output detailed logs to help with debugging

## Common Issues

1. **307 Redirects**: If webhooks are being redirected (e.g., adding/removing trailing slashes), this breaks signature verification.

2. **Missing Secrets**: Ensure webhook secrets are properly set in environment variables.

3. **Body Parsing**: The middleware and API routes are configured to preserve raw request bodies. Don't modify this setup.

## References

- [Clerk Webhooks Documentation](https://clerk.com/docs/webhooks/overview)
- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Next.js API Routes Documentation](https://nextjs.org/docs/api-routes/introduction)
- [Vercel Deployment Configuration](https://vercel.com/docs/concepts/projects/project-configuration) 