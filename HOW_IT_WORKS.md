# How SilentCall Works

## User Experience Flow

### For the "Callee" (Person who can't speak)

```
1. OPEN APP
   ↓
2. LOGIN
   • Enter name (device ID auto-generated)
   • Press "Login (Dev)"
   ↓
3. JOIN CALL
   • Enter room code (or create new)
   • Select role: "Callee (Receiving)"
   • Press "Join Call"
   ↓
4. RECEIVE INCOMING CALL
   • See live transcript of caller's speech
   • "Hi, can you hear me?"
   • "Are you there?"
   ↓
5. RESPOND VIA TEXT
   • Type message: "One sec…"
   • Click Quick Reply button
   • OR type custom message + press "Send"
   ↓
6. TTS PLAYS TO CALLER
   • Backend generates speech from text
   • Audio injected into call
   • Caller hears: "One sec…" (as synthesized voice)
   ↓
7. CALLER RESPONDS
   • More speech transcribed
   • Callee sees updated transcript
   ↓
8. REPEAT
   • Type, send, hear TTS, see transcript...
   • Full conversation flow
   ↓
9. HANG UP
   • Press "End Call"
   • Return to room selection
```

### For the "Caller" (Testing Device)

```
1-3. Same as Callee (login, join)
   But select role: "Caller (Testing)"
   ↓
4. MOCK TRANSCRIPT GENERATED
   • Server simulates caller's speech
   • Callee sees: "Hi, can you hear me?"
   ↓
5. RECEIVE CALLEE'S TEXT RESPONSE
   • Chat message appears on both devices
   ↓
6. TTS AUDIO RECEIVED
   • Audio data sent to this device
   • (In current MVP, audio is silent WAV)
   • Future: Will play as speaker audio
   ↓
7. REPEAT
   • Chat/transcript flowing both ways
```

---

## Technical Flow: How Each Component Works

### 1. Login Process

**User enters credentials** →

```
POST /api/auth/dev-login
Body: { deviceId: "device-abc", name: "John" }
```

**Server generates token** →

```javascript
{
  token: base64(
    JSON.stringify({
      userId: "user-xyz",
      deviceId: "device-abc",
      name: "John",
    }),
  );
}
```

**Mobile app stores token** →

```javascript
setToken(token);
```

**Mobile connects WebSocket** →

```javascript
const ws = new WebSocket("ws://localhost:8080");
```

**Mobile authenticates on WebSocket** →

```javascript
ws.send({
  type: "auth:init",
  payload: { token },
});
```

**Server validates token** →

```javascript
// Decode base64, verify format
// Register client in room manager
```

**Mobile receives confirmation** →

```javascript
{
  type: "auth:ready",
  payload: { userId: "user-xyz", name: "John" }
}
```

---

### 2. Room Joining

**Mobile sends room:join event** →

```javascript
{
  type: "room:join",
  payload: {
    roomId: "test-room",
    userId: "user-xyz",
    userName: "John",
    role: "callee"
  }
}
```

**Server processes** →

- Checks if room exists (creates if not)
- Adds participant to room
- Broadcasts participant:joined to others in room
- Sends room:joined confirmation with full participant list

**Mobile receives room:joined** →

```javascript
{
  type: "room:joined",
  payload: {
    roomId: "test-room",
    participants: [
      { userId: "user-xyz", name: "John", role: "callee" },
      { userId: "user-abc", name: "Jane", role: "caller" }
    ]
  }
}
```

**Mobile UI updates** →

- Hide room selection
- Show call screen with participants

---

### 3. Sending a Chat Message (Callee types reply)

**Mobile user types** → "One sec…"

**User presses Send or Quick Reply** →

```javascript
{
  type: "message:send",
  payload: {
    message: {
      id: "msg-123",
      senderId: "callee",
      senderName: "John",
      text: "One sec…",
      timestamp: 1702000000000,
      ttsSent: false
    }
  }
}
```

**Server receives message:send** →

1. Adds message to room history
2. **Triggers TTS Processing:**
   ```javascript
   const audioBuffer = await ttsProvider.synthesize("One sec…");
   const base64Audio = Buffer.from(audioBuffer).toString("base64");
   ```
3. Broadcasts message:sent to all in room
4. Broadcasts tts:response with audio

**All clients receive message:sent** →

```javascript
{
  type: "message:sent",
  payload: {
    message: { ... }
  }
}
```

→ Chat UI updates on both devices

**All clients receive tts:response** →

```javascript
{
  type: "tts:response",
  payload: {
    messageId: "msg-123",
    audio: "UklGRiYAAA...", // Base64 audio data
    format: "audio/wav",
    durationMs: 1000
  }
}
```

→ Mobile app receives audio buffer
→ (Future: Inject into WebRTC call stream)
→ (Current: Stored but not played, waiting for WebRTC audio injection)

---

### 4. Mock Speech-to-Text (STT) Simulation

**Caller device initiates call** →

- Microphone is "listening"
- Server generates mock transcript

**Server STT simulation** (in `stt.mock.ts`) →

```javascript
// Simulate word-by-word speech recognition
const phrase = "Hi, can you hear me?";
const words = phrase.split(" ");

setInterval(() => {
  // Every 300ms, add next word
  partialText = words.slice(0, wordIndex).join(" ");

  // Send partial update
  callback(partialText, partialText, false);

  // When done, send final
  callback(fullText, fullText, true);
}, 300);
```

**Server broadcasts transcript:partial** →

```javascript
{
  type: "transcript:partial",
  payload: {
    messageId: "tr-123",
    speaker: "caller",
    content: "Hi, can you",
    partial: true,
    timestamp: 1702000000000
  }
}
```

→ Callee sees: "Hi, can you" (blinking cursor)

**Server broadcasts transcript:final** →

```javascript
{
  type: "transcript:final",
  payload: {
    messageId: "tr-123",
    speaker: "caller",
    content: "Hi, can you hear me?",
    partial: false,
    timestamp: 1702000000000
  }
}
```

→ Callee sees: "Hi, can you hear me?" (final text)
→ Text saved to transcript history

---

### 5. Audio Flow (Voice Call - Current & Future)

**Current Phase (MVP):**

```
Callee's Mic
  ↓
WebRTC LocalStream
  ↓
LiveKit Relay
  ↓
WebRTC RemoteStream (on Caller side)
  ↓
Caller hears Callee's mic audio
```

**Future Phase (with TTS injection):**

```
Callee's Mic + TTS Audio
  ↓
Web Audio API Mix
  ↓
WebRTC LocalStream
  ↓
LiveKit Relay
  ↓
WebRTC RemoteStream
  ↓
Caller hears: Callee's mic + synthesized voice responses
```

**TTS Injection Logic (to be implemented):**

```typescript
// 1. Receive TTS audio from server
const ttsAudioBuffer = base64ToArrayBuffer(payload.audio);

// 2. Decode audio (WAV/MP3)
const audioContext = new AudioContext();
const audioBuffer = await audioContext.decodeAudioData(ttsAudioBuffer);

// 3. Create audio track from buffer
const stream = new MediaStream();
const audioTrack = audioContext.createMediaStreamSource(
  new AudioBufferSource(audioBuffer),
);
audioTrack.connect(audioContext.destination);

// 4. Mix with local mic stream
const mixer = new AudioContext();
const localStream = await mediaDevices.getUserMedia({ audio: true });
const micSource = mixer.createMediaStreamSource(localStream);
const ttsSource = mixer.createMediaStreamAudioSourceNode(ttsStream);

// 5. Add mixed track to WebRTC
micSource.connect(mixer.destination);
ttsSource.connect(mixer.destination);
peerConnection.addTrack(mixer.destination.stream.getAudioTracks()[0]);
```

---

## Data Structures at Each Stage

### In Mobile App Memory

```javascript
{
  // Auth
  isAuthenticated: true,
  userId: "user-xyz",
  token: "base64token...",

  // Room
  roomId: "test-room",
  participants: [
    { userId: "user-xyz", name: "John", role: "callee" },
    { userId: "user-abc", name: "Jane", role: "caller" }
  ],

  // Chat
  messages: [
    {
      id: "msg-1",
      senderId: "caller",
      senderName: "Jane",
      text: "Hi there!",
      timestamp: 1702000000000,
      ttsSent: true
    }
  ],

  // Transcript
  transcriptHistory: [
    {
      id: "tr-1",
      speaker: "caller",
      content: "Hi, can you hear me?",
      partial: false,
      timestamp: 1702000000100
    }
  ],

  // TTS Audio Buffer
  ttsAudioBuffer: {
    "msg-1": ArrayBuffer(...),
    "msg-2": ArrayBuffer(...)
  }
}
```

### In Backend Memory

```javascript
// rooms.ts
{
  "test-room": {
    roomId: "test-room",
    participants: [
      { userId: "user-xyz", name: "John", role: "callee", joinedAt: 1702000000000 },
      { userId: "user-abc", name: "Jane", role: "caller", joinedAt: 1702000000100 }
    ],
    createdAt: 1702000000000
  }
}

// transcriptHistory.ts
{
  "test-room": [
    {
      messageId: "tr-1",
      speaker: "caller",
      content: "Hi, can you hear me?",
      partial: false,
      timestamp: 1702000000100
    }
  ]
}

// chatHistory.ts
{
  "test-room": [
    {
      id: "msg-1",
      senderId: "caller",
      senderName: "Jane",
      text: "Hi there!",
      timestamp: 1702000000000,
      ttsSent: true
    }
  ]
}
```

---

## Message Flow Diagram

### Complete Call Scenario

```
Time    Caller Device           Server                    Callee Device
────    ─────────────────────   ──────────────────────    ──────────────────
T0      ┌─ Login ─────────┐
        │ auth:init       │ ────────────────────────────►
        └─────────────────┘
                                │ auth:ready ◄─ Accept token

T1      ┌─ Room Join ─────┐
        │ room:join       │ ────────────────────────────►
        │ (role: caller)  │
        └─────────────────┘
                                │ room:joined
                                ├─ participant:joined ───►
                                                          ┌─ Room Joined ─┐
                                                          │ (see caller)  │
                                                          └───────────────┘

T2                                                        ┌─ Login ─────────┐
                                                          │ auth:init       │
                                                          └────────────────►
                                                             (same flow)

T3                          ┌─ Mock STT Start ─┐
                            │ Generate phrase  │
                            │ "Hi, can you..." │
                            └──────────────────┘
                                                    ┌─ Receive Transcript ─┐
                                │ transcript:     │ "Hi, can" (partial)   │
                                │ partial        ├─────────────────────►│
                                │                │ See live text update  │
                                │ transcript:    │ "Hi, can you hear me?" │
                                │ final         ├─────────────────────►│
                                                 └───────────────────────┘

T4                                                ┌─ User Types Reply ────┐
                                                  │ "One sec…"            │
                                                  │ Press "Send"          │
                                                  └──────────┬────────────┘
                                                             │
                                                             ▼
                                                  ┌─ message:send ────────►
                                                  │ (text: "One sec…")    │

                                ┌─ Receive Message ─┐
                                │ message:sent      │ ────────────────────►
                                │                   │ Caller sees response
                                │ TTS Processing    │
                                │ (generate audio)  │
                                └───────────────────┘
                                                    ┌─ TTS Audio Received ──┐
                                │ tts:response     │ (audio buffer)        │
                                ├─────────────────►│ Audio ready to play   │
                                                   └───────────────────────┘

T5      ┌─ Receive Message ─┐
        │ Chat updates      │
        │ See: "Me: One..." │
        └───────────────────┘

Time    Continues...
────    Similar cycles for multi-turn conversation
```

---

## State Machine: App Navigation

```
                    ┌──────────────┐
                    │   START      │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
              ┌────►│LOGIN SCREEN  │◄────┐
              │     └──────┬───────┘     │
              │            │             │
              │            ▼             │
              │     [user logs in]       │
              │            │             │
              │            ▼             │ [logout]
              │    ┌──────────────────┐  │
              │    │ROOM SELECTION    │──┘
              │    │SCREEN           │
              │    └────┬─────────────┘
              │         │
              │         ▼
              │  [user selects room]
              │         │
              │         ▼
              │    ┌──────────────────┐
              │    │CALL SCREEN       │
              │    │(in room)         │
              │    └────┬─────────────┘
              │         │
              │         ▼
              │  [messages/chat]
              │         │
              │         ▼
              │  [user leaves room]
              │         │
              └─────────┘
```

---

## Example Conversation

### Two Devices, Same Room

```
Timeline:

[Device A - Caller joins]
"Hi there! Can you hear me?"
  ↓ (Mock STT generates)
Server: transcript:partial "Hi there"
Server: transcript:partial "Hi there Can"
Server: transcript:final "Hi there! Can you hear me?"
Server: broadcast to Callee
  ↓
[Device B - Callee sees]
Transcript: "Hi there! Can you hear me?"
Callee types: "Yes, I can hear you"
  ↓
[Both Devices]
Chat bubble: "Callee: Yes, I can hear you"
Server: TTS generates audio for "Yes, I can hear you"
Server: tts:response sent to both
Audio: (silent WAV in MVP, real voice in future)

[Device A - Caller]
Callee responds: "Yes, I can hear you"
Audio received: (would play TTS voice)

---

[Device B - Callee]
Caller speaks again: "Great! How are you today?"
  ↓ (Mock STT)
Transcript: "Great! How are you today?"

Callee clicks quick reply: "I'm doing well!"
  ↓
Chat updates
TTS audio generated

[Both see]
Full conversation history:
- Caller: "Hi there! Can you hear me?"
- Callee: "Yes, I can hear you"
- Caller: "Great! How are you today?"
- Callee: "I'm doing well!"
```

---

## Performance Characteristics

### Latency

- **Login:** 200-500ms (HTTP request + token generation)
- **WebSocket connect:** 100-300ms
- **Room join:** 50-100ms (in-memory operation)
- **Chat message send:** 50-150ms (broadcast + TTS generation)
- **Transcript update:** 10-50ms (broadcast only, no processing)
- **TTS audio delivery:** 100-500ms (mock: instant, real: depends on provider)

### Throughput

- **Concurrent users per server:** 100-500 (depending on hardware)
- **Messages per room:** No hard limit (stored in memory)
- **Transcript events:** 10-30 per minute (per caller)
- **Audio bandwidth:** ~100-500 Kbps per active call (WebRTC)

### Storage (Current MVP)

- **Per-user session:** ~1 KB
- **Per-room:** ~5-10 KB (chat + transcript)
- **In-memory total:** Scales with # of rooms × data per room
- **Audio buffers:** ~100-200 KB per message (depends on duration)

---

## Error Scenarios & Recovery

### Network Disconnection

```
1. WebSocket disconnects
2. Client: "Reconnecting..." (shows banner)
3. Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 5 attempts)
4. If reconnected:
   - Re-authenticate
   - Rejoin room
   - Fetch chat/transcript history
5. If failed:
   - Show "Offline" message
   - Offer manual retry
```

### TTS Generation Fails

```
1. Server: TTS provider error (e.g., API quota)
2. Server: Send error event
3. Client: Show "Audio generation failed"
4. User can retry by sending message again
```

### Authentication Expires

```
1. WebSocket: token validation fails
2. Server: Send error event
3. Client: Redirect to login
4. User re-authenticates
5. Rejoin room
```

---

Generated: 2026-02-22
Version: MVP 1.0
