/**
 * WebSocket Room Manager
 * Manages participant connections, message routing, and session state
 */

import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import {
  Room,
  RoomParticipant,
  TranscriptEvent,
  ChatMessage,
  WSMessage,
  RoomJoinPayload,
  ParticipantJoinedPayload,
  ParticipantLeftPayload,
  TranscriptPartialPayload,
  TranscriptFinalPayload,
  MessageSentPayload,
  TTSResponsePayload,
  ErrorPayload,
  TTSRequestPayload,
} from "@silentcall/shared";

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  userName: string;
  roomId?: string;
  role?: "caller" | "callee";
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private clients: Map<WebSocket, ClientConnection> = new Map();
  private transcriptHistory: Map<string, TranscriptEvent[]> = new Map();
  private chatHistory: Map<string, ChatMessage[]> = new Map();

  /**
   * Register a new client connection
   */
  registerClient(ws: WebSocket, userId: string, userName: string): void {
    this.clients.set(ws, {
      ws,
      userId,
      userName,
    });
  }

  /**
   * Unregister client (cleanup on disconnect)
   */
  unregisterClient(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (client && client.roomId) {
      this.leaveRoom(ws, client.roomId);
    }
    this.clients.delete(ws);
  }

  /**
   * Join a room
   */
  joinRoom(
    ws: WebSocket,
    roomId: string,
    role: "caller" | "callee",
  ): Room | null {
    const client = this.clients.get(ws);
    if (!client) return null;

    // Create room if it doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        roomId,
        participants: [],
        createdAt: Date.now(),
      });
      this.transcriptHistory.set(roomId, []);
      this.chatHistory.set(roomId, []);
    }

    const room = this.rooms.get(roomId)!;

    // Add participant
    const participant: RoomParticipant = {
      userId: client.userId,
      name: client.userName,
      role,
      joinedAt: Date.now(),
    };

    room.participants.push(participant);
    client.roomId = roomId;
    client.role = role;

    // Notify other participants
    this.broadcastToRoom(roomId, ws, {
      type: "participant:joined",
      payload: {
        participant,
      } as ParticipantJoinedPayload,
      timestamp: Date.now(),
    });

    return room;
  }

  /**
   * Leave a room
   */
  leaveRoom(ws: WebSocket, roomId: string): void {
    const client = this.clients.get(ws);
    if (!client) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.participants = room.participants.filter(
        (p) => p.userId !== client.userId,
      );

      // Notify others
      this.broadcastToRoom(roomId, ws, {
        type: "participant:left",
        payload: {
          userId: client.userId,
        } as ParticipantLeftPayload,
        timestamp: Date.now(),
      });

      // Clean up empty rooms
      if (room.participants.length === 0) {
        this.rooms.delete(roomId);
        this.transcriptHistory.delete(roomId);
        this.chatHistory.delete(roomId);
      }
    }

    client.roomId = undefined;
    client.role = undefined;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Add a transcript event (partial or final)
   */
  addTranscript(roomId: string, event: TranscriptEvent): void {
    const history = this.transcriptHistory.get(roomId) || [];
    history.push(event);
    this.transcriptHistory.set(roomId, history);

    // Broadcast to room
    this.broadcastToRoom(roomId, undefined, {
      type: event.partial ? "transcript:partial" : "transcript:final",
      payload: {
        messageId: event.messageId,
        speaker: event.speaker,
        content: event.content,
        timestamp: event.timestamp,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Add a chat message
   */
  addChatMessage(roomId: string, message: ChatMessage): void {
    const history = this.chatHistory.get(roomId) || [];
    history.push(message);
    this.chatHistory.set(roomId, history);

    // Broadcast to room
    this.broadcastToRoom(roomId, undefined, {
      type: "message:sent",
      payload: {
        message,
      } as MessageSentPayload,
      timestamp: Date.now(),
    });
  }

  /**
   * Get transcript history for a room
   */
  getTranscriptHistory(roomId: string): TranscriptEvent[] {
    return this.transcriptHistory.get(roomId) || [];
  }

  /**
   * Get chat history for a room
   */
  getChatHistory(roomId: string): ChatMessage[] {
    return this.chatHistory.get(roomId) || [];
  }

  /**
   * Broadcast message to all participants in a room
   */
  broadcastToRoom(
    roomId: string,
    excludeWs: WebSocket | undefined,
    message: WSMessage,
  ): void {
    this.clients.forEach((client, ws) => {
      if (client.roomId === roomId && ws !== excludeWs && ws.readyState === 1) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Send message to specific client
   */
  sendToClient(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast TTS response to room
   */
  broadcastTTSResponse(roomId: string, payload: TTSResponsePayload): void {
    this.broadcastToRoom(roomId, undefined, {
      type: "tts:response",
      payload,
      timestamp: Date.now(),
    });
  }

  /**
   * Get all active rooms (for stats/monitoring)
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }
}
