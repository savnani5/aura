import { RoomServiceClient, ParticipantInfo } from 'livekit-server-sdk';

/**
 * Service for interacting with LiveKit server API to get real-time room state
 * This replaces database participant tracking with actual LiveKit room state
 */
export class LiveKitRoomService {
  private static instance: LiveKitRoomService;
  private roomService: RoomServiceClient;

  private constructor() {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      throw new Error('Missing LiveKit configuration: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or LIVEKIT_URL');
    }

    this.roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
  }

  public static getInstance(): LiveKitRoomService {
    if (!LiveKitRoomService.instance) {
      LiveKitRoomService.instance = new LiveKitRoomService();
    }
    return LiveKitRoomService.instance;
  }

  /**
   * Check if a room exists and has active participants
   * Returns null if room doesn't exist, otherwise returns participant info
   */
  async getRoomParticipants(roomName: string): Promise<{
    exists: boolean;
    participantCount: number;
    participants: ParticipantInfo[];
  } | null> {
    try {
      console.log(`🔍 LIVEKIT: Checking room ${roomName} for active participants`);
      
      const participants = await this.roomService.listParticipants(roomName);
      
      const participantCount = participants.length;
      console.log(`👥 LIVEKIT: Room ${roomName} has ${participantCount} active participants`);
      
      // Log participant details for debugging
      if (participantCount > 0) {
        participants.forEach(p => {
          console.log(`  - ${p.name || p.identity} (${p.state})`);
        });
      }

      return {
        exists: true,
        participantCount,
        participants
      };
      
    } catch (error: any) {
      // Room not found or other error
      if (error.message?.includes('room not found') || error.code === 5) {
        console.log(`🏠 LIVEKIT: Room ${roomName} does not exist or has no participants`);
        return {
          exists: false,
          participantCount: 0,
          participants: []
        };
      }
      
      console.error(`❌ LIVEKIT: Error checking room ${roomName}:`, error);
      throw error;
    }
  }

  /**
   * Check if a room is empty (has no active participants)
   */
  async isRoomEmpty(roomName: string): Promise<boolean> {
    try {
      const roomInfo = await this.getRoomParticipants(roomName);
      return !roomInfo || roomInfo.participantCount === 0;
    } catch (error) {
      console.error(`❌ LIVEKIT: Error checking if room ${roomName} is empty:`, error);
      // If we can't check, assume it's not empty to be safe
      return false;
    }
  }

  /**
   * Get list of all active rooms
   */
  async listActiveRooms(): Promise<string[]> {
    try {
      const rooms = await this.roomService.listRooms();
      return rooms.map(room => room.name || '');
    } catch (error) {
      console.error('❌ LIVEKIT: Error listing active rooms:', error);
      return [];
    }
  }

  /**
   * Force disconnect all participants from a room (for cleanup)
   */
  async disconnectAllParticipants(roomName: string): Promise<void> {
    try {
      const roomInfo = await this.getRoomParticipants(roomName);
      if (!roomInfo || roomInfo.participantCount === 0) {
        console.log(`🏠 LIVEKIT: Room ${roomName} is already empty`);
        return;
      }

      console.log(`🚪 LIVEKIT: Disconnecting ${roomInfo.participantCount} participants from room ${roomName}`);
      
      // Disconnect each participant
      for (const participant of roomInfo.participants) {
        await this.roomService.removeParticipant(roomName, participant.identity);
        console.log(`  - Disconnected ${participant.name || participant.identity}`);
      }
      
    } catch (error) {
      console.error(`❌ LIVEKIT: Error disconnecting participants from room ${roomName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a room entirely (removes it from LiveKit)
   */
  async deleteRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.deleteRoom(roomName);
      console.log(`🗑️ LIVEKIT: Successfully deleted room ${roomName}`);
    } catch (error: any) {
      if (error.message?.includes('room not found') || error.code === 5) {
        console.log(`🏠 LIVEKIT: Room ${roomName} was already deleted`);
        return;
      }
      console.error(`❌ LIVEKIT: Error deleting room ${roomName}:`, error);
      throw error;
    }
  }
}
