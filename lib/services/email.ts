import { Resend } from 'resend';
import * as ics from 'ics';
import { IMeetingRoom, IMeeting } from '../database/mongodb';

export class EmailService {
  private static instance: EmailService;
  private resend: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }
    this.resend = new Resend(apiKey);
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Generate ICS calendar file for recurring meeting
   */
  private generateCalendarInvite(room: IMeetingRoom): string | null {
    try {
      const { title, recurringPattern } = room;
      // Updated to point to meeting prep section instead of direct meeting room
      const meetingPrepUrl = `https://www.tryaura.com/meetingroom/${room.roomName}`;
      
      if (!recurringPattern?.frequency || !recurringPattern?.time) {
        console.warn('Missing recurring pattern for calendar invite');
        return null;
      }

      // Parse time (expecting format like "10:00" or "14:30")
      const [hours, minutes] = recurringPattern.time.split(':').map(Number);
      
      // Get timezone - use stored timezone or default to UTC
      const timezone = recurringPattern.timezone || 'UTC';
      
      // Calculate start date in the specified timezone
      let startDate = new Date();
      if (recurringPattern.startDate) {
        startDate = new Date(recurringPattern.startDate);
      }
      
      // Set the time
      startDate.setHours(hours, minutes, 0, 0);
      
      // If start date is in the past, move to next occurrence
      const now = new Date();
      if (startDate < now) {
        switch (recurringPattern.frequency) {
          case 'daily':
            while (startDate < now) {
              startDate.setDate(startDate.getDate() + 1);
            }
            break;
          case 'weekly':
            while (startDate < now) {
              startDate.setDate(startDate.getDate() + 7);
            }
            break;
          case 'monthly':
            while (startDate < now) {
              startDate.setMonth(startDate.getMonth() + 1);
            }
            break;
        }
      }

      // End time (use duration from room settings or default to 1 hour)
      const durationMinutes = recurringPattern.duration || 60; // Default to 60 minutes
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + durationMinutes);

      // Generate recurrence rule
      let rrule: string;
      
      // Use end date if available, otherwise fall back to reasonable COUNT limits
      if (recurringPattern.endDate) {
        // Format end date as YYYYMMDD for ICS
        const endDateFormatted = recurringPattern.endDate.toISOString().split('T')[0].replace(/-/g, '');
        
        switch (recurringPattern.frequency) {
          case 'daily':
            rrule = `FREQ=DAILY;UNTIL=${endDateFormatted}`;
            break;
          case 'weekly':
            rrule = `FREQ=WEEKLY;UNTIL=${endDateFormatted}`;
            break;
          case 'monthly':
            rrule = `FREQ=MONTHLY;UNTIL=${endDateFormatted}`;
            break;
          default:
            rrule = `FREQ=WEEKLY;UNTIL=${endDateFormatted}`;
        }
      } else {
        // Fallback to COUNT-based rules when no end date is specified
        switch (recurringPattern.frequency) {
          case 'daily':
            rrule = 'FREQ=DAILY;COUNT=30'; // 30 occurrences
            break;
          case 'weekly':
            rrule = 'FREQ=WEEKLY;COUNT=26'; // 26 weeks (6 months)
            break;
          case 'monthly':
            rrule = 'FREQ=MONTHLY;COUNT=12'; // 12 months
            break;
          default:
            rrule = 'FREQ=WEEKLY;COUNT=26'; // Default to weekly
        }
      }

      const event = {
        title: `${title} - Aura Meeting`,
        description: `Join your Aura video meeting: ${meetingPrepUrl}\n\nMeeting Room: ${title}\nType: ${room.type}\nTimezone: ${timezone}\n\nThis is a recurring ${recurringPattern.frequency} meeting. Access your meeting room dashboard to prepare and join when it's time.\n\nNote: This meeting will appear in your local timezone in your calendar application.`,
        start: [
          startDate.getFullYear(),
          startDate.getMonth() + 1,
          startDate.getDate(),
          startDate.getHours(),
          startDate.getMinutes()
        ] as [number, number, number, number, number],
        end: [
          endDate.getFullYear(),
          endDate.getMonth() + 1,
          endDate.getDate(),
          endDate.getHours(),
          endDate.getMinutes()
        ] as [number, number, number, number, number],
        startOutputType: 'local' as const, // This tells the ICS library to use local time format
        endOutputType: 'local' as const,   // This ensures timezone compatibility
        location: meetingPrepUrl,
        url: meetingPrepUrl,
        recurrenceRule: rrule,
        organizer: { name: 'Aura', email: 'notifications@tryaura.com' },
        attendees: room.participants.map(p => ({
          name: p.name,
          email: p.email,
          rsvp: true
        }))
      };

      const { error, value } = ics.createEvent(event);
      
      if (error) {
        console.error('Error creating calendar event:', error);
        return null;
      }

      return value || null;
    } catch (error) {
      console.error('Error generating calendar invite:', error);
      return null;
    }
  }

  /**
   * Send meeting room invitation emails to participants
   */
  async sendMeetingInvitations(room: IMeetingRoom, hostName: string): Promise<{
    success: boolean;
    sentTo: string[];
    failedTo: string[];
    errors: string[];
  }> {
    const sentTo: string[] = [];
    const failedTo: string[] = [];
    const errors: string[] = [];

    try {
      // Generate calendar invite
      const calendarInvite = this.generateCalendarInvite(room);
      
      // Separate host and participants
      const participants = room.participants.filter(p => p.role !== 'host');
      const host = room.participants.find(p => p.role === 'host');
      
      // Updated to point to meeting prep section instead of direct meeting room
      const meetingPrepUrl = `https://www.tryaura.com/meetingroom/${room.roomName}`;
      
      // Create attachments if calendar invite was generated
      const attachments = calendarInvite ? [{
        filename: `${room.title.replace(/[^a-zA-Z0-9]/g, '-')}-meeting.ics`,
        content: Buffer.from(calendarInvite).toString('base64'),
        type: 'text/calendar',
        disposition: 'attachment'
      }] : [];

      // Send to participants
      for (const participant of participants) {
        try {
          await this.resend.emails.send({
            from: 'Aura <notifications@tryaura.com>',
            to: [participant.email],
            subject: `🎥 You're invited to join "${room.title}" on Aura`,
            html: this.generateParticipantInviteEmail(room, participant, hostName, meetingPrepUrl),
            attachments
          });
          
          sentTo.push(participant.email);
        } catch (error) {
          console.error(`Failed to send invite to ${participant.email}:`, error);
          failedTo.push(participant.email);
          errors.push(`${participant.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Send to host (different email template)
      if (host) {
        try {
          await this.resend.emails.send({
            from: 'Aura <notifications@tryaura.com>',
            to: [host.email],
            subject: `🎥 Your meeting room "${room.title}" is ready on Aura`,
            html: this.generateHostConfirmationEmail(room, host, meetingPrepUrl),
            attachments
          });
          
          sentTo.push(host.email);
        } catch (error) {
          console.error(`Failed to send confirmation to host ${host.email}:`, error);
          failedTo.push(host.email);
          errors.push(`${host.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        success: failedTo.length === 0,
        sentTo,
        failedTo,
        errors
      };

    } catch (error) {
      console.error('Error sending meeting invitations:', error);
      return {
        success: false,
        sentTo,
        failedTo: room.participants.map(p => p.email),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Generate participant invitation email HTML
   */
  private generateParticipantInviteEmail(
    room: IMeetingRoom, 
    participant: any, 
    hostName: string, 
    meetingPrepUrl: string
  ): string {
    const recurringInfo = room.recurringPattern ? 
      `<p style="margin: 16px 0; color: #6b7280; font-size: 14px;">
        📅 <strong>Schedule:</strong> ${room.recurringPattern.frequency} 
        ${room.recurringPattern.day ? `on ${room.recurringPattern.day}s` : ''} 
        at ${room.recurringPattern.time}
        ${room.recurringPattern.duration ? ` for ${room.recurringPattern.duration} minutes` : ''}
        ${room.recurringPattern.timezone ? ` (${room.recurringPattern.timezone})` : ''}
      </p>` : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>You're invited to join ${room.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; margin-bottom: 16px;">
        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">🎥 Aura</h1>
      </div>
    </div>

    <!-- Main Content -->
    <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-bottom: 24px;">
      <h2 style="margin: 0 0 24px 0; color: #1f2937; font-size: 24px; font-weight: 600;">
        You're invited to join "${room.title}"
      </h2>
      
      <p style="margin: 16px 0; color: #4b5563; font-size: 16px;">
        Hi ${participant.name},
      </p>
      
      <p style="margin: 16px 0; color: #4b5563; font-size: 16px;">
        ${hostName} has invited you to join a recurring meeting room on Aura. This is your space for ongoing collaboration with AI-powered meeting assistance.
      </p>

      <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
          📋 Meeting Details
        </h3>
        <p style="margin: 8px 0; color: #4b5563;"><strong>Room:</strong> ${room.title}</p>
        <p style="margin: 8px 0; color: #4b5563;"><strong>Type:</strong> ${room.type}</p>
        <p style="margin: 8px 0; color: #4b5563;"><strong>Host:</strong> ${hostName}</p>
        ${recurringInfo}
      </div>

      <!-- Access Button (updated to go to meeting prep) -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${meetingPrepUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; transition: transform 0.2s;">
          📋 Access Meeting Room
        </a>
      </div>

      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #0c4a6e; font-size: 14px;">
          💡 <strong>Tip:</strong> Click the button above to access your meeting room dashboard where you can prepare for meetings, view past discussions, and join when it's time!
        </p>
      </div>

      <p style="margin: 16px 0; color: #6b7280; font-size: 14px;">
        Meeting room link: <a href="${meetingPrepUrl}" style="color: #667eea; text-decoration: none;">${meetingPrepUrl}</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: #9ca3af; font-size: 12px;">
      <p style="margin: 8px 0;">
        Powered by <strong>Aura</strong> - AI-first video conferencing
      </p>
      <p style="margin: 8px 0;">
        This email was sent because you were invited to a meeting room.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate host confirmation email HTML
   */
  private generateHostConfirmationEmail(
    room: IMeetingRoom, 
    host: any, 
    meetingPrepUrl: string
  ): string {
    const participantsList = room.participants
      .filter(p => p.role !== 'host')
      .map(p => `<li style="margin: 4px 0; color: #4b5563;">${p.name} (${p.email})</li>`)
      .join('');

    const recurringInfo = room.recurringPattern ? 
      `<p style="margin: 16px 0; color: #6b7280; font-size: 14px;">
        📅 <strong>Schedule:</strong> ${room.recurringPattern.frequency} 
        ${room.recurringPattern.day ? `on ${room.recurringPattern.day}s` : ''} 
        at ${room.recurringPattern.time}
        ${room.recurringPattern.duration ? ` for ${room.recurringPattern.duration} minutes` : ''}
        ${room.recurringPattern.timezone ? ` (${room.recurringPattern.timezone})` : ''}
      </p>` : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your meeting room "${room.title}" is ready</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; margin-bottom: 16px;">
        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">🎥 Aura</h1>
      </div>
    </div>

    <!-- Main Content -->
    <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-bottom: 24px;">
      <h2 style="margin: 0 0 24px 0; color: #1f2937; font-size: 24px; font-weight: 600;">
        ✅ Your meeting room "${room.title}" is ready!
      </h2>
      
      <p style="margin: 16px 0; color: #4b5563; font-size: 16px;">
        Hi ${host.name},
      </p>
      
      <p style="margin: 16px 0; color: #4b5563; font-size: 16px;">
        Your meeting room has been created successfully! Invitations have been sent to all participants, and your recurring schedule is all set up.
      </p>

      <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
          📋 Room Details
        </h3>
        <p style="margin: 8px 0; color: #4b5563;"><strong>Room:</strong> ${room.title}</p>
        <p style="margin: 8px 0; color: #4b5563;"><strong>Type:</strong> ${room.type}</p>
        ${recurringInfo}
        ${participantsList ? `
        <p style="margin: 16px 0 8px 0; color: #4b5563;"><strong>Invited Participants:</strong></p>
        <ul style="margin: 0; padding-left: 20px;">
          ${participantsList}
        </ul>` : ''}
      </div>

      <!-- Action Buttons (updated to reflect meeting prep) -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${meetingPrepUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; margin: 8px; transition: transform 0.2s;">
          📋 Access Meeting Room
        </a>
      </div>

      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #065f46; font-size: 14px;">
          ✨ <strong>Pro Tip:</strong> Your meeting room includes AI-powered transcription, smart summaries, and persistent task management across all meetings! Use the dashboard to prepare for meetings and join when it's time.
        </p>
      </div>

      <p style="margin: 16px 0; color: #6b7280; font-size: 14px;">
        Meeting room dashboard: <a href="${meetingPrepUrl}" style="color: #667eea; text-decoration: none;">${meetingPrepUrl}</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: #9ca3af; font-size: 12px;">
      <p style="margin: 8px 0;">
        Powered by <strong>Aura</strong> - AI-first video conferencing
      </p>
      <p style="margin: 8px 0;">
        Manage your meeting rooms at <a href="https://www.tryaura.com" style="color: #667eea;">tryaura.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Send meeting summary emails to meeting participants
   */
  async sendMeetingSummary(
    meeting: IMeeting, 
    roomTitle: string,
    participants: Array<{name: string, email: string}>
  ): Promise<{
    success: boolean;
    sentTo: string[];
    failedTo: string[];
    errors: string[];
  }> {
    const sentTo: string[] = [];
    const failedTo: string[] = [];
    const errors: string[] = [];

    if (!meeting.summary || !meeting.summary.content) {
      return {
        success: false,
        sentTo: [],
        failedTo: participants.map(p => p.email),
        errors: ['Meeting summary not available']
      };
    }

    try {
      const meetingDate = meeting.startedAt.toLocaleDateString();
      const duration = meeting.duration ? 
        `${Math.floor(meeting.duration / 60)}h ${meeting.duration % 60}m` : 
        'Unknown duration';

      for (const participant of participants) {
        try {
          await this.resend.emails.send({
            from: 'Aura <notifications@tryaura.com>',
            to: [participant.email],
            subject: `📝 Meeting Summary: ${roomTitle} - ${meetingDate}`,
            html: this.generateMeetingSummaryEmail(meeting, roomTitle, participant, duration)
          });
          
          sentTo.push(participant.email);
        } catch (error) {
          console.error(`Failed to send summary to ${participant.email}:`, error);
          failedTo.push(participant.email);
          errors.push(`${participant.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        success: failedTo.length === 0,
        sentTo,
        failedTo,
        errors
      };

    } catch (error) {
      console.error('Error sending meeting summaries:', error);
      return {
        success: false,
        sentTo,
        failedTo: participants.map(p => p.email),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Generate meeting summary email HTML
   */
  private generateMeetingSummaryEmail(
    meeting: IMeeting,
    roomTitle: string, 
    participant: {name: string, email: string},
    duration: string
  ): string {
    const { summary } = meeting;
    const meetingDate = meeting.startedAt.toLocaleDateString();
    const meetingTime = meeting.startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Generate sections content for new format
    const sectionsContent = summary?.sections?.map(section => `
      <div style="margin: 20px 0;">
        <h4 style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px; font-weight: 600;"># ${section.title}</h4>
        <ul style="margin: 0; padding-left: 20px;">
          ${section.points.map(point => `
            <li style="margin: 8px 0; color: #4b5563; line-height: 1.5;">
              ${point.text}
            </li>
          `).join('')}
        </ul>
      </div>
    `).join('') || '';

    // Fallback to keyPoints for backward compatibility
    const keyPointsList = (!sectionsContent && summary?.keyPoints) ? summary.keyPoints.map(point => 
      `<li style="margin: 8px 0; color: #4b5563; line-height: 1.5;">${point}</li>`
    ).join('') : '';

    const actionItemsList = summary?.actionItems?.map(item => {
      // Handle both old string format and new structured format
      if (typeof item === 'string') {
        return `<li style="margin: 8px 0; color: #4b5563; line-height: 1.5;">${item}</li>`;
      } else {
        // New structured format
        return `<li style="margin: 8px 0; color: #4b5563; line-height: 1.5;">
          <strong>${item.title}</strong>
          ${item.owner && item.owner !== 'Unassigned' ? ` (Assigned to: ${item.owner})` : ''}
          ${item.priority ? ` [${item.priority} Priority]` : ''}
          ${item.context ? `<br><em style="color: #6b7280; font-size: 14px;">${item.context}</em>` : ''}
          ${item.dueDate ? `<br><small style="color: #6b7280;">Due: ${item.dueDate}</small>` : ''}
        </li>`;
      }
    }).join('') || '';

    const decisionsList = summary?.decisions?.map(decision => 
      `<li style="margin: 8px 0; color: #4b5563; line-height: 1.5;">${decision}</li>`
    ).join('') || '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Meeting Summary: ${roomTitle}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; margin-bottom: 16px;">
        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">🎥 Aura</h1>
      </div>
    </div>

    <!-- Main Content -->
    <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-bottom: 24px;">
      <h2 style="margin: 0 0 24px 0; color: #1f2937; font-size: 24px; font-weight: 600;">
        📝 Meeting Summary
      </h2>
      
      <p style="margin: 16px 0; color: #4b5563; font-size: 16px;">
        Hi ${participant.name},
      </p>
      
      <p style="margin: 16px 0; color: #4b5563; font-size: 16px;">
        Here's the AI-generated summary of your recent meeting. This summary includes key discussion points, decisions made, and action items.
      </p>

      <!-- Meeting Info -->
      <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
          📋 Meeting Information
        </h3>
        <p style="margin: 8px 0; color: #4b5563;"><strong>Room:</strong> ${roomTitle}</p>
        <p style="margin: 8px 0; color: #4b5563;"><strong>Date:</strong> ${meetingDate}</p>
        <p style="margin: 8px 0; color: #4b5563;"><strong>Time:</strong> ${meetingTime}</p>
        <p style="margin: 8px 0; color: #4b5563;"><strong>Duration:</strong> ${duration}</p>
        <p style="margin: 8px 0; color: #4b5563;"><strong>Type:</strong> ${meeting.type}</p>
      </div>

      <!-- Summary Content -->
      <div style="background: #fefefe; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
          💬 Summary
        </h3>
        <p style="margin: 0; color: #4b5563; line-height: 1.6;">
          ${summary?.content || 'No summary available.'}
        </p>
      </div>

      ${sectionsContent ? `
      <!-- Detailed Meeting Notes -->
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
          📋 Meeting Notes
        </h3>
        ${sectionsContent}
      </div>` : keyPointsList ? `
      <!-- Key Points (Fallback) -->
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
          🎯 Key Points
        </h3>
        <ul style="margin: 0; padding-left: 20px;">
          ${keyPointsList}
        </ul>
      </div>` : ''}

      ${actionItemsList ? `
      <!-- Action Items -->
      <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
          ✅ Action Items
        </h3>
        <ul style="margin: 0; padding-left: 20px;">
          ${actionItemsList}
        </ul>
      </div>` : ''}

      ${decisionsList ? `
      <!-- Decisions -->
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
          🎯 Decisions Made
        </h3>
        <ul style="margin: 0; padding-left: 20px;">
          ${decisionsList}
        </ul>
      </div>` : ''}

      <!-- Action Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://www.tryaura.com/meetingroom/${meeting.roomName}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; transition: transform 0.2s;">
          📊 View Full Meeting Details
        </a>
      </div>

      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          💡 <strong>Tip:</strong> All meeting summaries and transcripts are automatically saved in your meeting room for future reference.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: #9ca3af; font-size: 12px;">
      <p style="margin: 8px 0;">
        Powered by <strong>Aura</strong> - AI-first video conferencing
      </p>
      <p style="margin: 8px 0;">
        This summary was automatically generated by AI from your meeting transcript.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Send invitation emails to newly added participants
   */
  async sendNewParticipantInvitations(
    room: IMeetingRoom, 
    newParticipants: Array<{name: string, email: string, role: string}>,
    hostName: string
  ): Promise<{
    success: boolean;
    sentTo: string[];
    failedTo: string[];
    errors: string[];
  }> {
    const sentTo: string[] = [];
    const failedTo: string[] = [];
    const errors: string[] = [];

    try {
      const meetingPrepUrl = `https://www.tryaura.com/meetingroom/${room.roomName}`;
      
      // Generate calendar invite only if room has timing configured
      let calendarInvite = null;
      let attachments: any[] = [];
      
      if (room.recurringPattern?.frequency && room.recurringPattern?.time) {
        calendarInvite = this.generateCalendarInvite(room);
        if (calendarInvite) {
          attachments = [{
            filename: `${room.title.replace(/[^a-zA-Z0-9]/g, '-')}-meeting.ics`,
            content: Buffer.from(calendarInvite).toString('base64'),
            type: 'text/calendar',
            disposition: 'attachment'
          }];
        }
      }

      // Send emails to new participants (skip hosts since they're already part of the room)
      const participantsToEmail = newParticipants.filter(p => p.role !== 'host');
      
      for (const participant of participantsToEmail) {
        try {
          const emailSubject = room.recurringPattern?.frequency && room.recurringPattern?.time
            ? `🎥 You've been added to "${room.title}" on Aura`
            : `🎥 You've been added to "${room.title}" meeting room on Aura`;

          await this.resend.emails.send({
            from: 'Aura <notifications@tryaura.com>',
            to: [participant.email],
            subject: emailSubject,
            html: this.generateNewParticipantInviteEmail(room, participant, hostName, meetingPrepUrl),
            attachments
          });
          
          sentTo.push(participant.email);
        } catch (error) {
          console.error(`Failed to send invite to new participant ${participant.email}:`, error);
          failedTo.push(participant.email);
          errors.push(`${participant.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        success: failedTo.length === 0,
        sentTo,
        failedTo,
        errors
      };

    } catch (error) {
      console.error('Error sending new participant invitations:', error);
      return {
        success: false,
        sentTo,
        failedTo: newParticipants.map(p => p.email),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Generate new participant invitation email HTML (for participants added later)
   */
  private generateNewParticipantInviteEmail(
    room: IMeetingRoom, 
    participant: any, 
    hostName: string, 
    meetingPrepUrl: string
  ): string {
    const hasSchedule = room.recurringPattern?.frequency && room.recurringPattern?.time;
    
    const recurringInfo = hasSchedule ? 
      `<p style="margin: 16px 0; color: #6b7280; font-size: 14px;">
        📅 <strong>Schedule:</strong> ${room.recurringPattern?.frequency} 
        ${room.recurringPattern?.day ? `on ${room.recurringPattern.day}s` : ''} 
        at ${room.recurringPattern?.time}
        ${room.recurringPattern?.duration ? ` for ${room.recurringPattern.duration} minutes` : ''}
        ${room.recurringPattern?.timezone ? ` (${room.recurringPattern.timezone})` : ''}
      </p>` : '';

    const calendarNote = hasSchedule ? 
      `<div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #0c4a6e; font-size: 14px;">
          💡 <strong>Tip:</strong> A calendar invite is attached to this email. Add it to your calendar so you never miss a meeting!
        </p>
      </div>` :
      `<div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #92400e; font-size: 14px;">
          📝 <strong>Note:</strong> This meeting room doesn't have a fixed schedule yet. You'll be notified when meetings are scheduled!
        </p>
      </div>`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>You've been added to ${room.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; margin-bottom: 16px;">
        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">🎥 Aura</h1>
      </div>
    </div>

    <!-- Main Content -->
    <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-bottom: 24px;">
      <h2 style="margin: 0 0 24px 0; color: #1f2937; font-size: 24px; font-weight: 600;">
        🎉 You've been added to "${room.title}"
      </h2>
      
      <p style="margin: 16px 0; color: #4b5563; font-size: 16px;">
        Hi ${participant.name},
      </p>
      
      <p style="margin: 16px 0; color: #4b5563; font-size: 16px;">
        Great news! ${hostName} has added you to an existing meeting room on Aura. You're now part of the team and can access all meeting history, shared tasks, and upcoming sessions.
      </p>

      <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
          📋 Room Details
        </h3>
        <p style="margin: 8px 0; color: #4b5563;"><strong>Room:</strong> ${room.title}</p>
        <p style="margin: 8px 0; color: #4b5563;"><strong>Type:</strong> ${room.type}</p>
        <p style="margin: 8px 0; color: #4b5563;"><strong>Added by:</strong> ${hostName}</p>
        ${recurringInfo}
      </div>

      <!-- Access Button (updated to go to meeting prep) -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${meetingPrepUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; transition: transform 0.2s;">
          📋 Access Meeting Room
        </a>
      </div>

      ${calendarNote}

      <p style="margin: 16px 0; color: #6b7280; font-size: 14px;">
        Meeting room link: <a href="${meetingPrepUrl}" style="color: #667eea; text-decoration: none;">${meetingPrepUrl}</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: #9ca3af; font-size: 12px;">
      <p style="margin: 8px 0;">
        Powered by <strong>Aura</strong> - AI-first video conferencing
      </p>
      <p style="margin: 8px 0;">
        You received this email because you were added to a meeting room.
      </p>
    </div>
  </div>
</body>
</html>`;
  }
} 