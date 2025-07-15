import { clerkClient, WebhookEvent } from '@clerk/nextjs/server';
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { DatabaseService } from '@/lib/mongodb';

export async function POST(req: Request) {
  console.log('🎯 Clerk webhook received');
  
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('❌ Missing CLERK_WEBHOOK_SECRET');
    return NextResponse.json(
      { error: "Missing CLERK_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  console.log('📋 Webhook headers:', {
    svix_id: svix_id ? 'present' : 'missing',
    svix_timestamp: svix_timestamp ? 'present' : 'missing',
    svix_signature: svix_signature ? 'present' : 'missing'
  });

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('❌ Missing svix headers');
    return NextResponse.json(
      { error: "Error occurred -- no svix headers" },
      { status: 400 }
    );
  }

  // Get the body
  let payload;
  let body;
  try {
    payload = await req.json();
    body = JSON.stringify(payload);
    console.log('📦 Webhook payload received, event type:', payload.type);
  } catch (error) {
    console.error('❌ Error parsing webhook body:', error);
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
    console.log('✅ Webhook signature verified');
  } catch (err) {
    console.error("❌ Error verifying webhook:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // Get the ID and type
  const { id } = evt.data;
  const eventType = evt.type;

  console.log(`🎯 Processing webhook: ID=${id}, Type=${eventType}`);

  const db = DatabaseService.getInstance();

  try {
    // CREATE
    if (eventType === "user.created") {
      const { 
        id, 
        email_addresses, 
        first_name, 
        last_name,
        image_url,
        created_at,
      } = evt.data;

      // Check for referral data in user metadata
      const referredByMeta = evt.data.private_metadata?.referredBy || evt.data.public_metadata?.referredBy;
      const referredBy = typeof referredByMeta === 'string' && referredByMeta.trim() ? referredByMeta.trim() : undefined;

      const userData = {
        clerkId: id,
        name: `${first_name || ''} ${last_name || ''}`.trim() || 'Anonymous User',
        email: email_addresses[0]?.email_address || '',
        avatar: image_url || '',
        joinedAt: new Date(created_at),
        lastActive: new Date(),
        referredBy,
      };

      console.log('👤 Creating user:', userData.name, userData.email);

      const user = await db.createUser(userData);

      if (!user) {
        console.error('❌ Failed to create user in database');
        return NextResponse.json({ 
          message: "Failed to create user", 
          success: false 
        }, { status: 500 });
      }

      console.log('✅ User created successfully:', user._id);

      // Set public metadata
      try {
        const clerk = await clerkClient();
        await clerk.users.updateUserMetadata(id, {
          publicMetadata: {
            userId: user._id,
          },
        });
        console.log('✅ Clerk metadata updated');
      } catch (metadataError) {
        console.log("⚠️ Clerk metadata update failed - this is non-critical:", metadataError);
      }

      // Link user to any meeting rooms they were invited to before signing up
      if (user.email) {
        try {
          const linkedRooms = await db.linkUserToInvitedRooms(user._id, user.email);
          if (linkedRooms > 0) {
            console.log(`🔗 Linked user to ${linkedRooms} meeting rooms they were previously invited to`);
          }
        } catch (linkError) {
          console.log("⚠️ Error linking user to invited rooms - non-critical:", linkError);
        }
      }

      return NextResponse.json({ 
        message: "User created successfully", 
        user: { id: user._id, name: user.name, email: user.email },
        success: true 
      });
    }

    // UPDATE
    if (eventType === "user.updated") {
      const { id, email_addresses, first_name, last_name } = evt.data;

      const userData = {
        name: `${first_name || ''} ${last_name || ''}`.trim() || 'Anonymous User',
        email: email_addresses[0]?.email_address || '',
        lastActive: new Date(),
      };

      console.log('📝 Updating user:', id, userData.name);

      const updatedUser = await db.updateUser(id, userData);
      
      console.log('✅ User updated successfully');
      
      return NextResponse.json({ 
        message: "User updated successfully", 
        user: updatedUser ? { id: updatedUser._id, name: updatedUser.name, email: updatedUser.email } : null,
        success: true 
      });
    }

    // DELETE
    if (eventType === "user.deleted") {
      const { id } = evt.data;

      console.log('🗑️ Deleting user:', id);

      const deletedUser = await db.deleteUser(id!);

      console.log('✅ User deleted successfully');

      return NextResponse.json({ 
        message: "User deleted successfully", 
        user: deletedUser ? { id: deletedUser._id, name: deletedUser.name, email: deletedUser.email } : null,
        success: true 
      });
    }

    // Handle unknown event types
    console.log(`⚠️ Unhandled event type: ${eventType}`);
    return NextResponse.json({ 
      message: `Event type ${eventType} received but not handled`,
      success: true 
    });

  } catch (error) {
    console.error(`❌ Error processing ${eventType} webhook:`, error);
    return NextResponse.json({ 
      message: "Internal server error", 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    }, { status: 500 });
  }
} 