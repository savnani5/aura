import { clerkClient, WebhookEvent } from '@clerk/nextjs/server';
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { DatabaseService } from '@/lib/mongodb';

// Set to nodejs runtime to ensure the raw body is preserved
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';

// Ensure we're handling the specific methods we need
export async function POST(req: Request) {
  // Log the webhook receipt - this helps with debugging
  console.log('⚡ Clerk webhook received');
  console.log('🔍 Request URL:', req.url);
  
  // Get webhook secret from environment variable
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  
  // Check if in development mode - useful for debugging
  const isDevelopment = process.env.NODE_ENV === 'development' || 
                       process.env.VERCEL_ENV === 'development' ||
                       process.env.CLERK_DEV_MODE === 'true';
  
  console.log('🔧 Environment:', isDevelopment ? 'Development' : 'Production');

  if (!WEBHOOK_SECRET) {
    console.error('❌ Missing CLERK_WEBHOOK_SECRET');
    return new Response("Missing CLERK_WEBHOOK_SECRET", { status: 500 });
  }

  try {
    // Get the raw body as text for signature verification
    const rawBody = await req.text();
    
    // Get the headers - in Next.js 15.2.4, headers() returns a Promise that must be awaited
    const headersList = await headers();
    
    // Extract the Svix headers for verification
    const svix_id = headersList.get("svix-id");
    const svix_timestamp = headersList.get("svix-timestamp");
    const svix_signature = headersList.get("svix-signature");
    
    // Log header info for debugging
    console.log('📋 Webhook headers:', {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature ? `${svix_signature.substring(0, 10)}...` : 'missing'
    });
    
    // Debug log the size of the body
    console.log(`📦 Webhook body size: ${rawBody.length} bytes`);

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error('❌ Missing required Svix headers');
      return new Response("Error occurred -- missing required Svix headers", { status: 400 });
    }

    // Skip signature verification in development mode if needed
    let evt: WebhookEvent;
    
    if (isDevelopment && process.env.CLERK_SKIP_VERIFICATION === 'true') {
      // In development mode, optionally skip verification
      console.log('⚠️ Development mode: Skipping signature verification');
      try {
        evt = JSON.parse(rawBody) as WebhookEvent;
      } catch (err) {
        console.error('❌ Failed to parse webhook body:', err);
        return new Response("Error parsing webhook body", { status: 400 });
      }
    } else {
      // In production mode, always verify the signature
      try {
        // Create a new Svix instance with your secret
        const wh = new Webhook(WEBHOOK_SECRET);
        
        // Verify the payload with the headers
        evt = wh.verify(rawBody, {
          "svix-id": svix_id,
          "svix-timestamp": svix_timestamp,
          "svix-signature": svix_signature,
        }) as WebhookEvent;
        
        console.log('✅ Webhook signature verified successfully');
      } catch (err) {
        console.error("❌ Webhook signature verification failed:", err);
        
        // More detailed error logging
        if (err instanceof Error) {
          console.error({
            message: err.message,
            name: err.name,
            stack: err.stack?.split('\n').slice(0, 3).join('\n')
          });
        }
        
        return new Response("Error occurred - webhook verification failed", { status: 400 });
      }
    }

    // Get the ID and type
    const { id } = evt.data;
    const eventType = evt.type;

    console.log(`🔔 Processing webhook event: ${eventType} for ID: ${id}`);

    const db = DatabaseService.getInstance();

    // CREATE
    if (eventType === "user.created") {
      try {
        console.log('👤 Processing user.created event');
        
        const { 
          id, 
          email_addresses, 
          first_name, 
          last_name,
          image_url,
          created_at,
        } = evt.data;

        if (!email_addresses || email_addresses.length === 0) {
          console.warn('⚠️ No email addresses found in user data');
        }

        const userData = {
          clerkId: id,
          name: `${first_name || ''} ${last_name || ''}`.trim() || 'Anonymous User',
          email: email_addresses?.[0]?.email_address || '',
          avatar: image_url || '',
          joinedAt: new Date(created_at),
          lastActive: new Date(),
        };

        console.log('📝 Creating user with data:', {
          clerkId: userData.clerkId,
          name: userData.name,
          email: userData.email ? `${userData.email.substring(0, 3)}...` : 'none',
        });

        const user = await db.createUser(userData);

        if (!user) {
          console.error('❌ Failed to create user in database');
          return NextResponse.json({ 
            message: "Failed to create user", 
            success: false 
          }, { status: 500 });
        }

        console.log('✅ User created successfully in database');

        // Set public metadata
        try {
          const clerk = await clerkClient();
          await clerk.users.updateUserMetadata(id, {
            publicMetadata: {
              userId: user._id,
            },
          });
          console.log('✅ Updated Clerk metadata with database user ID');
        } catch (metadataError) {
          console.log("⚠️ Clerk metadata update failed - this is non-critical");
        }

        // Link user to any meeting rooms they were invited to before signing up
        if (user.email) {
          const linkedRooms = await db.linkUserToInvitedRooms(user._id, user.email);
          if (linkedRooms > 0) {
            console.log(`🔗 Linked user to ${linkedRooms} meeting rooms they were previously invited to`);
          }
        }

        return NextResponse.json({ 
          message: "User created successfully", 
          user: user,
          success: true 
        });
      } catch (error) {
        console.error('❌ Error in user.created webhook:', error);
        return NextResponse.json({ 
          message: "Internal server error", 
          success: false 
        }, { status: 500 });
      }
    }

    // UPDATE
    if (eventType === "user.updated") {
      try {
        console.log('🔄 Processing user.updated event');
        
        const { id, email_addresses, first_name, last_name } = evt.data;

        const userData = {
          name: `${first_name || ''} ${last_name || ''}`.trim() || 'Anonymous User',
          email: email_addresses?.[0]?.email_address || '',
          lastActive: new Date(),
        };

        console.log('📝 Updating user data:', {
          clerkId: id,
          name: userData.name,
          email: userData.email ? `${userData.email.substring(0, 3)}...` : 'none',
        });

        const updatedUser = await db.updateUser(id, userData);
        
        console.log('✅ User updated successfully in database');
        
        return NextResponse.json({ 
          message: "User updated successfully", 
          user: updatedUser,
          success: true 
        });
      } catch (error) {
        console.error("❌ Error updating user:", error);
        return NextResponse.json({ 
          message: "Failed to update user", 
          success: false 
        }, { status: 500 });
      }
    }

    // DELETE
    if (eventType === "user.deleted") {
      try {
        console.log('🗑️ Processing user.deleted event');
        
        const { id } = evt.data;
        console.log(`Deleting user with Clerk ID: ${id}`);

        const deletedUser = await db.deleteUser(id!);

        console.log('✅ User deleted successfully from database');
        
        return NextResponse.json({ 
          message: "User deleted successfully", 
          user: deletedUser,
          success: true 
        });
      } catch (error) {
        console.error("❌ Error deleting user:", error);
        return NextResponse.json({ 
          message: "Failed to delete user", 
          success: false 
        }, { status: 500 });
      }
    }

    // For any other event types
    console.log(`✓ Acknowledged event type: ${eventType}`);
    return NextResponse.json({ 
      message: "Webhook received", 
      type: eventType,
      success: true 
    });
  } catch (error) {
    console.error('❌ Unhandled error in webhook handler:', error);
    return NextResponse.json({ 
      message: "Internal server error", 
      success: false 
    }, { status: 500 });
  }
}

// Define other HTTP methods to return 405 Method Not Allowed
export async function GET() {
  return new Response('Method not allowed', { status: 405 });
}

export async function PUT() {
  return new Response('Method not allowed', { status: 405 });
}

export async function DELETE() {
  return new Response('Method not allowed', { status: 405 });
}

export async function PATCH() {
  return new Response('Method not allowed', { status: 405 });
} 