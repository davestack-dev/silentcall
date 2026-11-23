# SilentCall MVP - Quick Start Guide

## What is SilentCall?

SilentCall is a VoIP application for people who cannot speak verbally. Type text responses, and the caller hears a realistic voice. The callee sees live transcription of the caller's speech.

**Key Features:**

- ✅ Real-time text-to-speech (TTS) for outgoing messages
- ✅ Live speech-to-text (STT) transcription of incoming calls
- ✅ Quick reply buttons for common responses
- ✅ Multi-participant VoIP using WebRTC
- ✅ Privacy banner (transcription disclosure)
- ✅ Mocked STT/TTS for immediate MVP testing, with integration paths for real providers

**Current Status:** Mocked STT/TTS + full WebSocket + chat infrastructure. Real provider integration below.

---

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Docker** & **Docker Compose** (for LiveKit server)
- **Expo CLI** (for React Native testing)
- **Android Emulator** or physical Android device (iOS optional)
- **Git** (for version control)

### Installation

```bash
# Install Node.js 18+
# macOS (using Homebrew):
brew install node@18

# Windows (using Chocolatey):
choco install nodejs

# Linux (using package manager):
sudo apt-get install nodejs npm

# Install Docker & Docker Compose:
# https://docs.docker.com/get-docker/

# Install Expo CLI:
npm install -g expo-cli
```

---

## 🚀 Quick Start (5 minutes)

### Step 1: Install Dependencies

```bash
cd /path/to/call-pilot

# Install all workspace dependencies
npm install --workspaces

# Or manually:
cd packages/shared && npm install && npm run build
cd ../../apps/server && npm install
cd ../../apps/mobile && npm install
```

### Step 2: Start Backend + LiveKit

```bash
# Option A: Using Docker Compose (Recommended)
cd infra
docker-compose up --build

# This starts:
# - LiveKit (WebRTC) on ws://localhost:7880
# - SilentCall server on http://localhost:8080

# Option B: Manual (without Docker)
# Terminal 1 - Start LiveKit manually (requires Go):
livekit-server --config livekit.yaml

# Terminal 2 - Start SilentCall backend:
cd apps/server
npm install
npm run dev
# Server will be ready at http://localhost:8080
```

**Expected output:**

```
╔════════════════════════════════════════════════════════════════╗
║                    SilentCall Server Ready                    ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  HTTP Server:  http://localhost:8080
║  WebSocket:    ws://localhost:8080
║  LiveKit:      ws://localhost:7880
║  TTS Provider: mock
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

### Step 3: Start Mobile App (Two Clients Needed)

#### Option A: Using Expo Web (Quickest for testing)

```bash
cd apps/mobile
npm install
npm start

# Press 'w' to open in web browser
# This will open http://localhost:19006
```

**Note:** Web version has limitations. Use Android Emulator for full features.

#### Option B: Android Emulator (Recommended)

```bash
cd apps/mobile
npm install
npm start

# Prerequisites:
# 1. Install Android Studio: https://developer.android.com/studio
# 2. Create an Android Virtual Device (AVD) in Android Studio
# 3. Start the emulator from Android Studio

# In the Expo terminal, press 'a' to open in Android emulator
```

**On Android Emulator:**

- To access localhost on your machine, use `http://10.0.2.2:8080`
- Update `CallProvider` in `src/App.tsx`:
  ```tsx
  <CallProvider
    apiUrl="http://10.0.2.2:8080"
    wsUrl="ws://10.0.2.2:8080"
  >
  ```

#### Option C: Physical Android Device

```bash
# On your computer:
cd apps/mobile
npm start

# On your Android device:
# 1. Install Expo Go from Google Play Store
# 2. Scan the QR code shown in the Expo terminal
# 3. Update the API URL in src/App.tsx to your machine's IP:
#    apiUrl="http://YOUR_MACHINE_IP:8080"
#    wsUrl="ws://YOUR_MACHINE_IP:8080"
```

### Step 4: Test the App

**Scenario: Two clients in the same room**

1. **First Device (Callee):**
   - Login (any name, auto-generated device ID)
   - Enter room code: `test-room`
   - Select role: **"Callee (Receiving)"**
   - Join call

2. **Second Device (Caller):**
   - Login (different name)
   - Enter room code: `test-room` (same!)
   - Select role: **"Caller (Testing)"**
   - Join call

3. **Test Flow:**
   - Caller speaks into the mic (simulated by mock STT)
   - Callee sees live transcript: "Hi, can you hear me?"
   - Callee clicks quick reply: "One sec…"
   - TTS audio is generated (mocked as silent WAV for now)
   - Both participants see chat history

---

## 🔄 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   SilentCall MVP                            │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌─────────────────┐
│  Mobile App      │         │  Backend Server │
│  (React Native)  │◄───────►│  (Node + WS)    │
│                  │  WebSocket             │
│ • Chat UI        │         │ • Room Mgmt     │
│ • Transcript     │         │ • Transcript    │
│ • TTS Playback   │         │ • TTS Queue     │
│ • STT Mic Input  │         │ • Mocked STT/TTS│
└──────────────────┘         └─────────────────┘
        ▲                            ▲
        │                            │
        │ WebRTC Audio               │ LiveKit
        │ (Caller ◄──► Callee)       │ (VOIP Server)
        │                            │
        └────────────────┬───────────┘
                         │
                  ┌──────▼──────┐
                  │  LiveKit    │
                  │  (Docker)   │
                  └─────────────┘
```

### Data Flow

1. **Authentication:**
   - User logs in with dev credentials → Backend generates JWT token
   - App stores token and connects WebSocket

2. **Room Management:**
   - WebSocket event: `room:join` → Server creates/joins room
   - Server broadcasts: `room:joined` + participant list

3. **Transcription (STT):**
   - Caller's audio → Mock STT → generates fake transcripts
   - Events: `transcript:partial`, `transcript:final`
   - Callee sees live updates in UI

4. **Chat & TTS:**
   - Callee types message → `message:send` WebSocket event
   - Server processes TTS → generates audio (mocked as silent WAV)
   - Event: `tts:response` with base64-encoded audio
   - Audio injected into WebRTC stream (future phase)

---

## 📁 Project Structure

```
call-pilot/
├── package.json                    # Monorepo root
├── infra/
│   ├── docker-compose.yml          # LiveKit + Server orchestration
│   ├── livekit.yaml                # LiveKit configuration
│   └── .env.example                # Environment template
├── packages/
│   └── shared/
│       ├── src/
│       │   └── index.ts            # Shared types & event definitions
│       ├── tsconfig.json
│       └── package.json
├── apps/
│   ├── server/
│   │   ├── src/
│   │   │   ├── index.ts            # Express + WebSocket server
│   │   │   ├── room.ts             # Room management
│   │   │   ├── tts.mock.ts         # Mocked TTS provider
│   │   │   └── stt.mock.ts         # Mocked STT provider
│   │   ├── Dockerfile              # Server Docker image
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── mobile/
│       ├── src/
│       │   ├── App.tsx             # Main app component
│       │   ├── CallContext.tsx      # State management
│       │   ├── ws-client.ts        # WebSocket client
│       │   ├── webrtc-audio.ts    # WebRTC audio handler
│       │   └── screens/
│       │       ├── LoginScreen.tsx
│       │       ├── RoomSelectionScreen.tsx
│       │       └── CallScreen.tsx
│       ├── app.json                # Expo config
│       ├── index.ts                # Entry point
│       ├── tsconfig.json
│       └── package.json
└── README.md                        # This file
```

---

## 🎯 What's Mocked vs Real

### Phase 1: MVP (Current)

| Component                | Status     | Details                                  |
| ------------------------ | ---------- | ---------------------------------------- |
| **WebSocket Chat**       | ✅ Real    | Full message routing, history            |
| **Room Management**      | ✅ Real    | Multi-participant rooms                  |
| **UI**                   | ✅ Real    | Chat, transcript, quick replies          |
| **STT (Speech-to-Text)** | 🟡 Mocked  | Fake transcripts, simulated word-by-word |
| **TTS (Text-to-Speech)** | 🟡 Mocked  | Silent WAV files, placeholder audio      |
| **WebRTC Audio**         | ⚠️ Partial | Basic stream setup, audio injection WIP  |

### Phase 2: Real Providers (Integration Guide Below)

---

## 🔌 Integrating Real STT Provider

### Example: Google Cloud Speech-to-Text

**Step 1: Set up Google Cloud credentials**

```bash
# Create a Google Cloud project
# Enable Speech-to-Text API
# Create a Service Account key JSON file
# Export credentials:

export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

**Step 2: Install SDK**

```bash
cd apps/server
npm install @google-cloud/speech
```

**Step 3: Create real STT provider** (`src/stt.google.ts`)

```typescript
import { STTProvider } from "@silentcall/shared";
import speech from "@google-cloud/speech";

export class GoogleSTTProvider implements STTProvider {
  private client = new speech.SpeechClient();
  private isStreaming = false;
  private callback?: (partial: string, final: string, isFinal: boolean) => void;

  async startStream(): Promise<void> {
    this.isStreaming = true;
    // Initialize streaming recognition
  }

  async stopStream(): Promise<void> {
    this.isStreaming = false;
  }

  async processAudio(audioChunk: ArrayBuffer): Promise<void> {
    // Send to Google Cloud Speech API
  }

  getTranscript(): string {
    // Return current transcript
    return "";
  }

  onTranscript(
    callback: (partial: string, final: string, isFinal: boolean) => void,
  ): void {
    this.callback = callback;
  }
}
```

**Step 4: Update server to use Google STT**

In `apps/server/src/index.ts`, replace mock provider:

```typescript
import { createGoogleSTTProvider } from "./stt.google";

// Instead of:
// const sttProvider = createSTTProvider();

// Use:
const sttProvider = createGoogleSTTProvider();
```

---

## 🔌 Integrating Real TTS Provider

### Example: Google Cloud Text-to-Speech

**Step 1: Install SDK (if not already done)**

```bash
cd apps/server
npm install @google-cloud/text-to-speech
```

**Step 2: Create real TTS provider** (`src/tts.google.ts`)

```typescript
import { TTSProvider } from "@silentcall/shared";
import textToSpeech from "@google-cloud/text-to-speech";

export class GoogleTTSProvider implements TTSProvider {
  private client = new textToSpeech.TextToSpeechClient();

  async synthesize(text: string, voiceId?: string): Promise<ArrayBuffer> {
    const request = {
      input: { text },
      voice: {
        languageCode: "en-US",
        name: voiceId || "en-US-Neural2-C",
      },
      audioConfig: { audioEncoding: "MP3" },
    };

    const [response] = await this.client.synthesizeSpeech(request);
    const audioContent = response.audioContent as Uint8Array;
    return audioContent.buffer;
  }

  async getVoices(): Promise<
    Array<{ id: string; name: string; gender: string }>
  > {
    // List available voices
    return [
      { id: "en-US-Neural2-C", name: "Alex (US)", gender: "male" },
      { id: "en-US-Neural2-A", name: "Amy (US)", gender: "female" },
    ];
  }
}
```

**Step 3: Update server**

```typescript
import { createGoogleTTSProvider } from "./tts.google";

// Instead of:
// const ttsProvider = createTTSProvider();

// Use:
const ttsProvider = createGoogleTTSProvider();
```

---

## 🌍 Deploying to Production

### Option 1: Heroku (Backend only)

```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create silentcall-backend

# Set environment variables
heroku config:set LIVEKIT_URL=wss://your-livekit-server.com
heroku config:set TTS_PROVIDER=google

# Deploy
git push heroku main
```

### Option 2: AWS / DigitalOcean (Full Stack)

- Host LiveKit on EC2 / Droplet
- Deploy backend to App Platform / ECS
- Use CloudFront / CDN for static assets
- See deployment guides in `/docs/deploy/`

### Option 3: Self-Hosted

```bash
# Start all services locally
docker-compose -f infra/docker-compose.yml up -d

# Expose via ngrok for testing:
ngrok http 8080
```

---

## 🐛 Troubleshooting

### Backend won't start

```bash
# Check if port 8080 is in use
lsof -i :8080  # macOS/Linux
netstat -ano | findstr :8080  # Windows

# Kill process or use different port
PORT=3000 npm run dev
```

### WebSocket connection fails

```bash
# Check server is running:
curl http://localhost:8080/health

# Check firewall allows WebSocket:
# Windows Firewall → Allow Node.js through firewall
```

### Mobile app can't reach backend

```bash
# If using Android Emulator:
# Replace localhost with: 10.0.2.2
# Update: src/App.tsx
apiUrl="http://10.0.2.2:8080"
wsUrl="ws://10.0.2.2:8080"

# If using physical device:
# Find your machine's IP:
ipconfig getifaddr en0  # macOS
ipconfig  # Windows (look for IPv4 Address)
# Update src/App.tsx with that IP
```

### TTS audio not playing

- Currently mocked as silent WAV (Phase 2 feature)
- Check server logs for TTS generation errors
- See "Integrating Real TTS Provider" above

### Transcript not updating

```bash
# Check mock STT is generating data:
# Look for "[TTS]" log lines in server output

# STT is mocked to simulate word-by-word updates
# In production, integrate real provider (see above)
```

---

## 📊 Testing Scenarios

### Scenario 1: Basic Chat Flow

```
Device A (Callee):
1. Login → Room "test" → Role "Callee"
2. See: "Waiting for caller..."

Device B (Caller):
1. Login → Room "test" → Role "Caller"
2. Callee sees: "Participant joined"

Both:
3. Chat appears → Quick replies visible
4. Callee clicks "One sec…" → Both see message
5. Server generates TTS audio (silent) → Broadcast to room
```

### Scenario 2: Multiple Participants

```
Three devices, same room code:
- All see each other in participant list
- Chat messages broadcast to all
- TTS audio sent to all (future: only to caller)
```

### Scenario 3: Reconnection

```
1. Start call normally
2. Disconnect device (WiFi off, app closes)
3. WebSocket auto-reconnects (max 5 attempts)
4. Transcript/chat history restored
5. Rejoin room automatically
```

---

## 📚 API Documentation

### REST Endpoints

#### `POST /api/auth/dev-login`

Dev login for testing (no password required).

```json
{
  "deviceId": "device-abc123",
  "name": "John"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user-xyz",
  "expiresIn": 86400
}
```

#### `GET /api/tts/voices`

List available TTS voices.

**Response:**

```json
[
  { "id": "voice-1", "name": "Alex (US)", "gender": "male" },
  { "id": "voice-2", "name": "Victoria (US)", "gender": "female" }
]
```

#### `GET /api/rooms`

List active rooms (debugging).

**Response:**

```json
[
  {
    "roomId": "test-room",
    "participants": [{ "userId": "user-1", "name": "Alice", "role": "caller" }],
    "createdAt": 1702000000000
  }
]
```

### WebSocket Events

#### Client → Server

- **`auth:init`** - Authenticate with token

  ```json
  { "token": "..." }
  ```

- **`room:join`** - Join a room

  ```json
  {
    "roomId": "...",
    "userId": "...",
    "userName": "...",
    "role": "caller|callee"
  }
  ```

- **`message:send`** - Send chat message

  ```json
  { "message": { "id": "...", "text": "...", "senderId": "..." } }
  ```

- **`transcript:partial`** - Partial STT result (client sends to server)
  ```json
  { "messageId": "...", "speaker": "caller", "content": "..." }
  ```

#### Server → Client

- **`room:joined`** - Successfully joined room

  ```json
  { "roomId": "...", "participants": [...], "liveKitUrl": "..." }
  ```

- **`participant:joined`** - New participant joined

  ```json
  { "participant": { "userId": "...", "name": "...", "role": "..." } }
  ```

- **`message:sent`** - New chat message

  ```json
  { "message": { "id": "...", "text": "...", "senderId": "..." } }
  ```

- **`transcript:partial`** - Partial transcription

  ```json
  { "messageId": "...", "speaker": "caller", "content": "...", "partial": true }
  ```

- **`transcript:final`** - Final transcription

  ```json
  {
    "messageId": "...",
    "speaker": "caller",
    "content": "...",
    "partial": false
  }
  ```

- **`tts:response`** - TTS audio ready
  ```json
  {
    "messageId": "...",
    "audio": "base64-encoded...",
    "format": "audio/wav",
    "durationMs": 1000
  }
  ```

---

## 🔐 Security & Privacy

### Current MVP

- ✅ Privacy banner displayed: "Transcription is enabled. Inform the caller."
- ✅ Chat/transcript stored in memory only (cleared on disconnect)
- ✅ No audio stored by default
- ⚠️ Dev login (no password) - for testing only
- ⚠️ WebSocket unencrypted (use HTTPS/WSS in production)

### Production Recommendations

1. **Authentication:**
   - Replace dev login with proper OAuth2 / JWT
   - Implement rate limiting

2. **Encryption:**
   - Enable WSS (WebSocket Secure / TLS)
   - Use HTTPS for REST endpoints
   - Encrypt audio at rest (if storing)

3. **Compliance:**
   - GDPR: Implement user consent & data deletion
   - HIPAA (if medical use): Encrypt end-to-end
   - ADA: Ensure captioning + audio descriptions

4. **Transcription:**
   - Require explicit caller consent (currently shown in banner)
   - Option to not record transcripts
   - GDPR right to be forgotten

---

## 🎨 Customization

### Changing UI Theme

Edit `apps/mobile/src/screens/CallScreen.tsx`:

```typescript
const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff", // Change color here
  },
  // ... rest of styles
});
```

### Adding More Quick Replies

Edit `packages/shared/src/index.ts`:

```typescript
export const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { id: "q1", text: "I'm in a meeting, I'll reply by text." },
  { id: "q2", text: "One sec…" },
  // Add more:
  { id: "q6", text: "Call me back later" },
];
```

### Changing Room Configuration

Edit `apps/server/src/room.ts`:

```typescript
// Adjust room cleanup timeout
const ROOM_TIMEOUT = 3600000; // 1 hour
```

---

## 📞 Support & Contribution

### Issues?

1. Check the **Troubleshooting** section above
2. Enable debug logging: `DEBUG=silentcall:* npm run dev`
3. Check server logs for errors

### Want to Contribute?

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes, test locally
4. Open a PR with description

---

## 📄 License

SilentCall MVP is open source. See LICENSE for details.

---

## 🎓 Learning Resources

- **WebRTC:** https://webrtc.org/getting-started/overview
- **WebSocket:** https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- **React Native:** https://reactnative.dev
- **TypeScript:** https://www.typescriptlang.org
- **Express.js:** https://expressjs.com
- **Expo:** https://docs.expo.dev

---

## 🚀 Next Steps

1. ✅ Get MVP running locally
2. 🔄 Integrate real STT provider (Google Cloud, Azure, Whisper)
3. 🔄 Integrate real TTS provider (Google Cloud, ElevenLabs, Azure)
4. 🔄 Implement WebRTC audio injection (TTS → caller speaker)
5. 🔄 Add user profiles & history
6. 🔄 Mobile UI refinements
7. 🔄 Production deployment

---

**Happy calling! 🎉**

For updates, questions, or feedback, reach out to the team.
