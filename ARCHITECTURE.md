# SilentCall MVP - Architecture & Design

## System Architecture

### High-Level Design

```
┌───────────────────────────────────────────────────────────────────┐
│                     SilentCall Ecosystem                          │
└───────────────────────────────────────────────────────────────────┘

                         [Mobile Clients]
                         (React Native)
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
              [Device A] [Device B] [Device C]

                    WebSocket + HTTP
                         │
              ┌──────────▼──────────┐
              │  SilentCall Server  │
              │  (Node.js/Express)  │
              │                     │
              │ • Room Management   │
              │ • Message Routing   │
              │ • TTS Processing    │
              │ • STT Streaming     │
              │ • Session Storage   │
              └──────────┬──────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   [LiveKit]       [TTS Provider]   [STT Provider]
   (WebRTC)        (Mock/Google)    (Mock/Google)
   VOIP Server     Voice Synth      Speech Recog
```

### Component Breakdown

#### 1. Mobile App (`/apps/mobile`)

**Responsibilities:**

- User authentication & session management
- Room joining/leaving
- Live chat UI
- Microphone capture (for STT)
- TTS audio playback
- Transcript display

**Tech Stack:**

- React Native (cross-platform)
- Expo (development/deployment)
- TypeScript (type safety)
- WebSocket client (real-time comm)
- React Native WebRTC (audio stream)

**State Management:**

- `CallContext` (global state)
- Local component state for UI

#### 2. Backend Server (`/apps/server`)

**Responsibilities:**

- User authentication
- Room/participant management
- WebSocket connection handling
- Message routing & broadcasting
- TTS request queueing & response delivery
- STT transcript streaming
- Session persistence (in-memory for MVP)

**Tech Stack:**

- Node.js 18+
- Express.js (REST API)
- WebSocket Server (`ws` library)
- TypeScript
- Mock STT/TTS providers (swappable)

**Key Modules:**

- `room.ts` - Room state & participant management
- `index.ts` - Express + WebSocket server
- `tts.mock.ts` - Mocked TTS provider
- `stt.mock.ts` - Mocked STT provider

#### 3. Shared Types (`/packages/shared`)

**Responsibilities:**

- Event type definitions
- Interface contracts
- Provider abstractions

**Contents:**

- `index.ts` - All TypeScript interfaces & type definitions

#### 4. Infrastructure (`/infra`)

**Components:**

- **LiveKit** - WebRTC VOIP server (audio stream relay)
- **Docker Compose** - Orchestration for local dev

**Deployment:**

- Docker containers for isolated services
- Network communication via bridge network

---

## Event Protocol (WebSocket)

### Authentication Flow

```
Client                          Server
  │                               │
  ├─ connect ──────────────────┤
  │                               │
  │                  auth:init ◄──┤ (challenge)
  │                               │
  ├─ auth:init ─────────────────► (token)
  │                               │
  │                  auth:ready ◄─┤
  │                               │
  └── authenticated ──────────────┘
```

### Room Join Flow

```
Client A                   Server                   Client B
  │                          │                        │
  ├─ room:join ─────────────►│                        │
  │                          │                        │
  │         room:joined ◄────┤                        │
  │                          │                        │
  │                    participant:joined ──────────►│
  │                          │                        │
  │◄─────── participant:joined ────────┤
  │                          │                        │
  └── in same room ──────────┼────── in same room ───┘
```

### Chat & TTS Flow

```
Callee (A)                  Server                  Caller (B)
  │                          │                        │
  ├─ message:send ──────────►│                        │
  │ (text reply)             │                        │
  │                          ├─ TTS Processing       │
  │                          │ (generate audio)      │
  │                          │                        │
  │◄─ message:sent ──────────┤                        │
  │ (broadcast)         tts:response ──────────────►│
  │                    (audio base64)               │
  │                          │                        │
  │                          ├─ Audio injected      │
  │                          │ into call stream     │
  │                          │                        │
  │                          │◄─ Audio played ──────┤
  │                          │                        │
  └─────────────────────────────────────────────────┘
       Caller hears synthesized voice
```

### Transcript Flow (STT)

```
Caller (A)                 Server                   Callee (B)
  │                          │                        │
  ├─ Audio Input (mic) ─────►│                        │
  │                          │                        │
  │                  STT Processing (mock)           │
  │                          │                        │
  │              transcript:partial ◄────────────────┤
  │ (word-by-word)          │                        │
  │                          │ broadcasts ─────────►│
  │                          │                        │
  │              transcript:final ◄───────────────────┤
  │                          │                        │
  │                          │ broadcasts ─────────►│
  │                          │                        │
  └─────────────────────────────────────────────────┘
      Callee sees live transcription
```

---

## Data Models

### User/Session

```typescript
interface Session {
  userId: string; // e.g., "user-abc123"
  deviceId: string; // e.g., "device-xyz"
  name: string; // Display name
  token: string; // JWT-like token
  createdAt: number; // Timestamp
}
```

### Room

```typescript
interface Room {
  roomId: string; // e.g., "room-test-123"
  participants: RoomParticipant[];
  createdAt: number;
  liveKitUrl?: string; // WebRTC connection URL
}

interface RoomParticipant {
  userId: string;
  name: string;
  role: "caller" | "callee";
  joinedAt: number;
}
```

### Messages

```typescript
// Chat message
interface ChatMessage {
  id: string;
  senderId: string; // "caller" or "callee"
  senderName: string;
  text: string; // The typed text
  timestamp: number;
  ttsSent: boolean; // Whether TTS was generated
}

// Transcript event (from STT)
interface TranscriptEvent {
  messageId: string;
  speaker: "caller" | "callee";
  content: string; // Transcribed text
  partial: boolean; // true = still being spoken
  timestamp: number;
}
```

### TTS/STT

```typescript
// TTS Request
interface TTSRequest {
  messageId: string;
  text: string; // Text to synthesize
  voiceId?: string; // e.g., "en-US-Neural2-C"
}

// TTS Response
interface TTSResponse {
  messageId: string;
  audio: string; // Base64-encoded audio
  format: "audio/wav";
  durationMs: number; // Duration of audio
}
```

---

## Provider Interfaces

### STT Provider

```typescript
interface STTProvider {
  // Start listening for audio
  startStream(): Promise<void>;

  // Stop listening
  stopStream(): Promise<void>;

  // Process audio chunk
  processAudio(audioChunk: ArrayBuffer): Promise<void>;

  // Get current transcript
  getTranscript(): string;

  // Register callback for updates
  onTranscript(
    callback: (partial: string, final: string, isFinal: boolean) => void,
  ): void;
}
```

**Mock Implementation:**

- Generates fake transcripts from predefined phrases
- Updates word-by-word every 300ms
- No actual audio processing

**Real Implementation (Google Cloud):**

```typescript
// Would use @google-cloud/speech
// Streams audio to Google Cloud API
// Returns real transcription
```

### TTS Provider

```typescript
interface TTSProvider {
  // Synthesize text to audio
  synthesize(text: string, voiceId?: string): Promise<ArrayBuffer>;

  // Get available voices
  getVoices(): Promise<Array<{ id: string; name: string; gender: string }>>;
}
```

**Mock Implementation:**

- Generates silent WAV files
- Duration based on text length
- No actual audio synthesis

**Real Implementation (Google Cloud):**

```typescript
// Would use @google-cloud/text-to-speech
// Returns neural-synthesized MP3/WAV
// Multiple voices/languages supported
```

---

## State Management (Mobile)

### CallContext

Global state for call-related data:

```typescript
interface CallContextType {
  // Auth
  isAuthenticated: boolean;
  userId: string | null;
  token: string | null;
  login: (deviceId: string, name: string) => Promise<void>;
  logout: () => void;

  // Connection
  isConnected: boolean;
  wsClient: WSClient | null;

  // Room
  roomId: string | null;
  participants: RoomParticipant[];
  joinRoom: (roomId: string, role: "caller" | "callee") => Promise<void>;
  leaveRoom: () => void;

  // Chat
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<void>;
  sendQuickReply: (text: string) => Promise<void>;

  // Transcript
  transcriptHistory: TranscriptMessage[];
  currentTranscript: string;
  addTranscriptPartial: (speaker: "caller" | "callee", content: string) => void;
  addTranscriptFinal: (speaker: "caller" | "callee", content: string) => void;

  // TTS Audio
  ttsAudioBuffer: Map<string, ArrayBuffer>;
  receiveTTSAudio: (messageId: string, audio: ArrayBuffer) => void;
}
```

Provides via `useCall()` hook to all components.

---

## Error Handling

### Server-Side

```typescript
// WebSocket error responses
{
  type: "error",
  payload: {
    code: "AUTH_FAILED" | "NOT_AUTH" | "TTS_FAILED" | "SERVER_ERROR",
    message: "Human-readable error"
  }
}
```

### Client-Side

- Try-catch blocks around async operations
- Alert dialogs for user-facing errors
- Automatic reconnection for WebSocket
- Graceful degradation if services unavailable

---

## Performance Considerations

### Optimization Strategies

1. **Message History Limits**
   - Store last 100 messages in memory
   - Clear on room close

2. **Transcript Batching**
   - Partial updates every 100ms (not per word)
   - Reduces network overhead

3. **TTS Caching**
   - Cache audio by message ID
   - Prevent re-synthesis for same text

4. **WebSocket Optimization**
   - Binary protocol could replace JSON (future)
   - Message compression for large payloads

5. **Mobile Performance**
   - Lazy load screens
   - Virtualize long lists (if needed)
   - Throttle UI updates

### Scalability

**Current Limits (Single Server):**

- ~100-200 concurrent connections
- ~10-20 active rooms

**Scaling Strategy:**

1. Add Redis for session storage
2. Use WebSocket cluster (Socket.io or similar)
3. Load balance across multiple server instances
4. Separate TTS/STT processing to worker queues

---

## Security Model

### Authentication (MVP)

**Current:** Dev login (no password)

```
POST /api/auth/dev-login
Body: { deviceId, name }
Response: { token, userId }
Token: Base64 JWT-like structure
```

**Production:** Replace with OAuth2/OIDC

```
- Proper JWT signing
- Refresh tokens
- Expiration handling
- Rate limiting
```

### Authorization

**Room Access Control:**

- Any authenticated user can join any room
- MVP: No private rooms
- Future: Invite-based access

**Data Privacy:**

- Participants only see own messages
- No cross-room visibility
- Room isolation at server level

### Encryption

**Current:** HTTP/WS (unencrypted)
**Production:**

- HTTPS for REST endpoints
- WSS (WebSocket Secure) for WebSocket
- End-to-end encryption for audio (optional)

---

## Database Schema (Future)

For production with persistence:

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE,
  display_name VARCHAR,
  created_at TIMESTAMP
);

-- Rooms
CREATE TABLE rooms (
  id UUID PRIMARY KEY,
  created_by UUID REFERENCES users(id),
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMP
);

-- Room Participants
CREATE TABLE room_participants (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES rooms(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR,
  joined_at TIMESTAMP
);

-- Chat Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES rooms(id),
  sender_id UUID REFERENCES users(id),
  text TEXT,
  created_at TIMESTAMP
);

-- Transcripts
CREATE TABLE transcripts (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES rooms(id),
  speaker VARCHAR,
  content TEXT,
  created_at TIMESTAMP
);
```

---

## Deployment Architecture

### Development (Docker Compose)

```
Host Machine
├─ Backend Server (Node.js)
├─ LiveKit (Docker container)
└─ Mobile App (Expo/Emulator)
```

### Production (Scalable)

```
Load Balancer (CloudFront/ALB)
├─ API Servers (ECS/EC2)
├─ WebSocket Servers (cluster)
├─ Redis Cache
├─ PostgreSQL Database
├─ S3 Storage (audio files)
└─ LiveKit Cluster (multi-region)
```

---

## Testing Strategy

### Unit Tests

```typescript
// Example: Room management
describe("RoomManager", () => {
  it("should create room on first join", () => {
    const manager = new RoomManager();
    const room = manager.joinRoom(ws, "test-room", "caller");
    expect(room?.roomId).toBe("test-room");
  });
});
```

### Integration Tests

```typescript
// Example: Auth flow
describe("Auth Flow", () => {
  it("should authenticate and connect", async () => {
    const response = await fetch("/api/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({ deviceId: "test", name: "User" }),
    });
    expect(response.status).toBe(200);
  });
});
```

### E2E Tests

```typescript
// Example: Chat flow
describe("Chat E2E", () => {
  it("should send message and receive TTS", () => {
    // 1. Create 2 clients
    // 2. Join same room
    // 3. Send message
    // 4. Verify TTS response received
  });
});
```

---

## Troubleshooting Guide for Developers

### Common Issues

1. **WebSocket won't connect**
   - Check server is running: `curl http://localhost:8080/health`
   - Check firewall allows port 8080
   - Enable debug logging in client

2. **TTS audio not generating**
   - Check server logs for errors
   - Verify TTS provider environment variables
   - Test endpoint: `GET /api/tts/voices`

3. **Transcript not updating**
   - Mock STT may be on delay
   - Check client is in correct room
   - Verify WebSocket message is received

4. **Room participants not visible**
   - Confirm both clients joined same room ID
   - Check participant:joined events in server logs
   - Verify room history is being broadcast

---

## Future Enhancements

1. **Phase 2 Features**
   - Real STT integration (Google/Azure/Whisper)
   - Real TTS integration (ElevenLabs/Google)
   - WebRTC audio injection
   - User profiles & history

2. **Phase 3 Features**
   - Call recording & playback
   - SMS/Phone number support (via Twilio)
   - Multi-language support
   - Accessibility improvements (haptic feedback, screen reader)

3. **Advanced Features**
   - Real-time translation
   - Emotion detection
   - Callback scheduling
   - CRM integration

---

## References

- [WebRTC Specification](https://www.w3.org/TR/webrtc/)
- [WebSocket RFC 6455](https://tools.ietf.org/html/rfc6455)
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

Generated: 2026-02-22
Version: MVP 1.0
