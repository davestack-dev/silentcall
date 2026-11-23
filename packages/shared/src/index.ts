/**
 * SilentCall Shared Types & Event Definitions
 * Protocol for WebSocket communication between mobile app and backend
 */

// ============================================================================
// AUTHENTICATION & SESSION
// ============================================================================

export interface DevUser {
  id: string;
  deviceId: string;
  name: string;
}

export interface SessionToken {
  token: string;
  userId: string;
}

// ============================================================================
// ROOM MANAGEMENT
// ============================================================================

export interface RoomParticipant {
  userId: string;
  name: string;
  role: "caller" | "callee"; // caller = speaking, callee = responding
  joinedAt: number;
}

export interface Room {
  roomId: string;
  participants: RoomParticipant[];
  createdAt: number;
  liveKitUrl?: string; // If using LiveKit, connection URL
}

// ============================================================================
// TRANSCRIPT & TRANSCRIPTION
// ============================================================================

export interface TranscriptMessage {
  id: string;
  speaker: "caller" | "callee"; // Who said it
  content: string;
  partial: boolean; // true = still being spoken, false = final
  timestamp: number;
}

export interface TranscriptEvent {
  messageId: string;
  speaker: "caller" | "callee";
  content: string;
  partial: boolean;
  timestamp: number;
}

// ============================================================================
// CHAT & REPLIES
// ============================================================================

export interface ChatMessage {
  id: string;
  senderId: string; // "caller" or "callee"
  senderName: string;
  text: string; // The typed reply
  timestamp: number;
  ttsSent: boolean; // Whether TTS was already requested for this
}

export interface QuickReply {
  id: string;
  text: string;
  icon?: string;
}

export const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { id: "q1", text: "I'm in a meeting, I'll reply by text." },
  { id: "q2", text: "One sec…" },
  { id: "q3", text: "Can you repeat that?" },
  { id: "q4", text: "Yes" },
  { id: "q5", text: "No" },
];

// ============================================================================
// TTS (TEXT-TO-SPEECH) REQUESTS & RESPONSES
// ============================================================================

export interface TTSRequest {
  messageId: string;
  text: string;
  voiceId?: string; // e.g., "en-US-Neural2-C" for Google Cloud
  speakerId?: string; // Who is "speaking" via TTS
  timestamp: number;
}

export interface TTSAudioChunk {
  chunk: string; // Base64-encoded audio
  format: "audio/mpeg" | "audio/wav" | "audio/pcm"; // Audio format
  complete: boolean; // false = more chunks coming, true = finished
}

export interface TTSResponse {
  messageId: string;
  audio: string; // Base64-encoded complete audio file
  format: "audio/mpeg" | "audio/wav" | "audio/pcm";
  durationMs: number;
}

// ============================================================================
// WEBSOCKET EVENT PAYLOADS
// ============================================================================

/** Event sent by client on connection to establish session */
export interface WSMessage<T = any> {
  type: string;
  payload: T;
  timestamp: number;
}

// --- Room Events ---
export interface RoomJoinPayload {
  roomId: string;
  userId: string;
  userName: string;
  role: "caller" | "callee";
  liveKitToken?: string; // If using LiveKit, include token
}

export interface RoomJoinedPayload {
  roomId: string;
  participants: RoomParticipant[];
  liveKitUrl?: string;
}

export interface RoomLeavePayload {
  roomId: string;
  userId: string;
}

export interface ParticipantJoinedPayload {
  participant: RoomParticipant;
}

export interface ParticipantLeftPayload {
  userId: string;
}

// --- Transcript Events ---
export interface TranscriptPartialPayload {
  messageId: string;
  speaker: "caller" | "callee";
  content: string; // Partial text
  timestamp: number;
}

export interface TranscriptFinalPayload {
  messageId: string;
  speaker: "caller" | "callee";
  content: string; // Final text
  timestamp: number;
}

// --- Chat & TTS Events ---
export interface MessageSentPayload {
  message: ChatMessage;
}

export interface TTSRequestPayload extends TTSRequest {
  // Extend if needed
}

export interface TTSResponsePayload {
  messageId: string;
  audio: string; // Base64
  format: string;
  durationMs: number;
}

// --- Error & Status ---
export interface ErrorPayload {
  code: string;
  message: string;
}

export interface StatusPayload {
  status: string;
  details?: Record<string, any>;
}

// ============================================================================
// EVENT TYPES REGISTRY
// ============================================================================

export type WSEventType =
  | "auth:init"
  | "auth:ready"
  | "room:join"
  | "room:joined"
  | "room:leave"
  | "participant:joined"
  | "participant:left"
  | "transcript:partial"
  | "transcript:final"
  | "message:send"
  | "message:sent"
  | "message:received"
  | "tts:request"
  | "tts:response"
  | "error"
  | "status";

// ============================================================================
// STT PROVIDER INTERFACE (for integration)
// ============================================================================

export interface STTProvider {
  /** Start streaming recognition */
  startStream(): Promise<void>;
  /** Stop streaming recognition */
  stopStream(): Promise<void>;
  /** Process audio chunk */
  processAudio(audioChunk: ArrayBuffer): Promise<void>;
  /** Get current transcript */
  getTranscript(): string;
  /** Register callback for transcript updates */
  onTranscript(
    callback: (partial: string, final: string, isFinal: boolean) => void,
  ): void;
}

// ============================================================================
// TTS PROVIDER INTERFACE (for integration)
// ============================================================================

export interface TTSProvider {
  /** Request audio synthesis */
  synthesize(text: string, voiceId?: string): Promise<ArrayBuffer>;
  /** Get available voices */
  getVoices(): Promise<Array<{ id: string; name: string; gender: string }>>;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface WebRTCConfig {
  iceServers?: RTCIceServer[];
  videoDecode?: boolean;
  videoEncode?: boolean;
  audioCodec?: "opus";
}

export interface AppConfig {
  apiUrl: string;
  wsUrl: string;
  liveKitUrl?: string;
  webrtcConfig?: WebRTCConfig;
}
