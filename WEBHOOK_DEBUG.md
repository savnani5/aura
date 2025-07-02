# Webhook Debugging Guide

## Recent Changes Made

### 1. Fixed Middleware Configuration
- Added webhook routes to bypass Clerk middleware processing
- Prevents 307 redirects by excluding `/api/webhooks/*` from authentication checks

### 2. Added Vercel Configuration
- Created `vercel.json` with proper webhook route handling
- Set appropriate timeout limits for webhook functions
- Added cache control headers for webhook routes

### 3. Improved Error Handling
- Enhanced logging with emojis for better visibility
- Added proper error responses with JSON format
- Better error handling for edge cases

## Testing Your Webhooks

### 1. Test Basic Routing
```bash
# Test if webhook routes are accessible
curl https://tryohm.com/api/webhooks/test
```

### 2. Test Clerk Webhook (from Clerk Dashboard)
- Go to Clerk Dashboard > Webhooks
- Test your webhook endpoint: `https://tryohm.com/api/webhooks/clerk`
- Check the response logs

### 3. Test Stripe Webhook (from Stripe Dashboard) 
- Go to Stripe Dashboard > Webhooks
- Test your webhook endpoint: `https://tryohm.com/api/webhooks/stripe`
- Check the response logs

## Common Issues and Solutions

### 307 Temporary Redirect Error
**Cause**: Middleware processing webhook routes or trailing slash redirects
**Solution**: ✅ Fixed by excluding webhook routes from middleware

### 404 Not Found Error
**Cause**: Route not properly configured or deployed
**Solution**: Check that the route files exist and are deployed

### 500 Internal Server Error
**Cause**: Code errors, missing environment variables, or database issues
**Solution**: Check server logs and environment variables

## Environment Variables Required

### Clerk Webhook
```env
CLERK_WEBHOOK_SECRET=whsec_...
```

### Stripe Webhook
```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Vercel Deployment Notes

1. Make sure `vercel.json` is in your project root
2. Redeploy after making these changes
3. Check Vercel function logs for webhook execution
4. Webhook URLs should not have trailing slashes

## Debug Commands

```bash
# Check if webhook route is accessible
curl -X GET https://tryohm.com/api/webhooks/test

# Test POST to webhook
curl -X POST https://tryohm.com/api/webhooks/test -d '{"test": "data"}' -H "Content-Type: application/json"

# Check Vercel logs
vercel logs --follow
```

## Next Steps

1. Deploy these changes to Vercel
2. Test the webhook endpoints using the Clerk and Stripe dashboards
3. Monitor the logs for any remaining issues
4. Update webhook URLs in both Clerk and Stripe dashboards if needed

The main issue was that your middleware was processing webhook routes and causing redirects. Now webhook routes completely bypass middleware processing, which should resolve the 307 errors. 