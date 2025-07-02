import { clerkClient, WebhookEvent } from '@clerk/nextjs/server';
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { DatabaseService } from '@/lib/mongodb';

// Ensure proper runtime for webhook handling
export const runtime = 'nodejs';

export async function POST(req: Request) {
  console.log('Clerk webhook received');
  
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('Missing CLERK_WEBHOOK_SECRET');
    return new Response("Missing CLERK_WEBHOOK_SECRET", {
      status: 500,
    });
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('Missing svix headers');
    return new Response("Error occurred -- no svix headers", {
      status: 400,
    });
  }

  // Get the raw body for signature verification
  const body = await req.text();

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
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occurred", {
      status: 400,
    });
  }

  // Get the ID and type
  const { id } = evt.data;
  const eventType = evt.type;

  console.log(`Webhook with ID ${id} and type ${eventType}`);

  const db = DatabaseService.getInstance();

  // CREATE
  if (eventType === "user.created") {
    try {
      const { 
        id, 
        email_addresses, 
        first_name, 
        last_name,
        image_url,
        created_at,
      } = evt.data;

      const userData = {
        clerkId: id,
        name: `${first_name || ''} ${last_name || ''}`.trim() || 'Anonymous User',
        email: email_addresses[0]?.email_address || '',
        avatar: image_url || '',
        joinedAt: new Date(created_at),
        lastActive: new Date(),
      };

      const user = await db.createUser(userData);

      if (!user) {
        console.error('Failed to create user in database');
        return NextResponse.json({ 
          message: "Failed to create user", 
          success: false 
        }, { status: 500 });
      }

      // Set public metadata
      try {
        const clerk = await clerkClient();
        await clerk.users.updateUserMetadata(id, {
          publicMetadata: {
            userId: user._id,
          },
        });
      } catch (metadataError) {
        console.log("Clerk metadata update failed - this is non-critical");
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
      console.error('Error in user.created webhook:', error);
      return NextResponse.json({ 
        message: "Internal server error", 
        success: false 
      }, { status: 500 });
    }
  }

  // UPDATE
  if (eventType === "user.updated") {
    try {
      const { id, email_addresses, first_name, last_name } = evt.data;

      const userData = {
        name: `${first_name || ''} ${last_name || ''}`.trim() || 'Anonymous User',
        email: email_addresses[0]?.email_address || '',
        lastActive: new Date(),
      };

      const updatedUser = await db.updateUser(id, userData);
      
      return NextResponse.json({ 
        message: "User updated successfully", 
        user: updatedUser,
        success: true 
      });
    } catch (error) {
      console.error("Error updating user:", error);
      return NextResponse.json({ 
        message: "Failed to update user", 
        success: false 
      }, { status: 500 });
    }
  }

  // DELETE
  if (eventType === "user.deleted") {
    try {
      const { id } = evt.data;

      const deletedUser = await db.deleteUser(id!);

      return NextResponse.json({ 
        message: "User deleted successfully", 
        user: deletedUser,
        success: true 
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      return NextResponse.json({ 
        message: "Failed to delete user", 
        success: false 
      }, { status: 500 });
    }
  }

  return new Response("", { status: 200 });
} 