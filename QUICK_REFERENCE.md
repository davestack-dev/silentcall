# SilentCall Quick Reference

## 🎯 One-Minute Quick Start

```bash
# 1. Backend
cd infra && docker-compose up --build

# 2. Mobile (new terminal)
cd apps/mobile && npm start
# Press 'a' for Android Emulator

# 3. Test
# Open 2 emulators
# Device 1: Join room "test" as "Callee"
# Device 2: Join room "test" as "Caller"
# Chat!
```

## 📱 Testing Scenarios

### Scenario 1: Basic Chat (Easiest)

```
Device A (Callee):
1. Login: name = "Alice"
2. Room = "demo", role = "Callee"
3. Wait for Device B

Device B (Caller):
1. Login: name = "Bob"
2. Room = "demo", role = "Caller"
3. See: Alice joined

Both:
4. Chat messages flow
5. Quick replies appear
6. Transcript updates
```

### Scenario 2: Multiple Rooms

```
Device A ─►  Room "sales" (Callee)
Device B ─►  Room "support" (Callee)
Device C ─►  Room "sales" (Caller)
Device D ─►  Room "support" (Caller)

Each room independent, messages don't cross.
```

## 🔧 API Endpoints

### Authentication

```
POST /api/auth/dev-login
{
  "deviceId": "device-abc",
  "name": "John"
}
→ { token, userId, expiresIn }
```

### Utilities

```
GET /health                    # Server health
GET /api/tts/voices            # Available voices
GET /api/tts/health            # TTS provider status
GET /api/rooms                 # All active rooms
```

## 🌐 WebSocket Events (Cheat Sheet)

### Client → Server

```
auth:init          { token }
room:join          { roomId, userId, userName, role }
room:leave         { roomId }
message:send       { message }
transcript:partial { messageId, speaker, content }
transcript:final   { messageId, speaker, content }
tts:request        { messageId, text, voiceId }
```

### Server → Client

```
auth:ready              { userId, name }
room:joined             { roomId, participants, liveKitUrl }
participant:joined     { participant }
participant:left       { userId }
message:sent            { message }
transcript:partial     { messageId, speaker, content, partial }
transcript:final       { messageId, speaker, content, partial }
tts:response            { messageId, audio, format, durationMs }
error                   { code, message }
```

## 🐛 Troubleshooting Flowchart

```
App won't start?
├─ Backend running? → curl http://localhost:8080/health
├─ Port 8080 free? → lsof -i :8080 (macOS) or netstat -ano | findstr :8080 (Windows)
└─ npm install done? → npm install --workspaces

WebSocket fails?
├─ Server log shows errors?
├─ Check firewall allows 8080
└─ Try different port: PORT=3000 npm run dev

Mobile can't reach server?
├─ Using Android Emulator?
│  └─ Change localhost → 10.0.2.2 in src/App.tsx
├─ Using physical phone?
│  └─ Use your machine's IP (ifconfig)
└─ Check both are on same network

No messages appearing?
├─ Check both devices in same room ID
├─ Check browser console for errors
└─ Check server logs for [WS] messages

TTS not playing?
├─ Currently mocked (silent) - expected behavior
├─ Real TTS comes in Phase 2
└─ Check server logs for [TTS] messages
```

## 📊 File Locations Reference

```
Key Files
├─ Backend server             apps/server/src/index.ts
├─ WebSocket handler         apps/server/src/room.ts
├─ Mock TTS                  apps/server/src/tts.mock.ts
├─ Mobile app                apps/mobile/src/App.tsx
├─ Call state management     apps/mobile/src/CallContext.tsx
├─ Shared types              packages/shared/src/index.ts
├─ Docker setup              infra/docker-compose.yml
└─ All documentation         README.md, RUN.md, ARCHITECTURE.md
```

## 🔄 Event Flow Example

```
Callee types "One sec"
│
▼
message:send event
│
▼ Server
├─ Add to chat history
├─ Broadcast message:sent
├─ Generate TTS (mock)
└─ Broadcast tts:response
│
▼ Both devices
├─ Chat UI updates (new bubble)
├─ Receive TTS audio (base64)
└─ Audio stored in buffer
```

## 🎨 Customization Quick Edits

### Change primary color

File: `apps/mobile/src/screens/CallScreen.tsx`

```typescript
headerTitle: {
  color: "#2563eb",  // Change this (blue to your color)
}
```

### Add more quick replies

File: `packages/shared/src/index.ts`

```typescript
export const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { id: "q1", text: "I'm in a meeting, I'll reply by text." },
  { id: "q2", text: "One sec…" },
  { id: "q6", text: "YOUR NEW REPLY HERE" }, // Add here
];
```

### Change room cleanup timeout

File: `apps/server/src/room.ts`

```typescript
const ROOM_TIMEOUT = 3600000; // 1 hour (edit this)
```

## ⚡ Performance Tips

```
If slow:
├─ Reduce message history limit (see .env.example)
├─ Disable debug logging: DEBUG=""
├─ Check network latency: ping 10.0.2.2
└─ Clear device storage & restart

If crashes:
├─ Check memory: node --max-old-space-size=2048
├─ Update npm packages: npm update --workspaces
└─ Clear npm cache: npm cache clean --force
```

## 📞 Environment Variable Cheat Sheet

```bash
# Backend
export NODE_ENV=development
export PORT=8080
export LIVEKIT_URL=ws://localhost:7880
export TTS_PROVIDER=mock

# Mobile (in src/App.tsx)
apiUrl="http://10.0.2.2:8080"      # Android Emulator
apiUrl="http://YOUR_IP:8080"       # Physical device
wsUrl="ws://10.0.2.2:8080"         # Android Emulator
wsUrl="ws://YOUR_IP:8080"          # Physical device
```

## 🚀 Common Commands

```bash
# Install everything
npm install --workspaces

# Build shared types
npm run build --workspace=@silentcall/shared

# Run backend
npm run dev --workspace=@silentcall/server

# Run mobile
npm start --workspace=@silentcall/mobile

# Run with Docker
cd infra && docker-compose up

# View logs
docker-compose logs -f silentcall-server
docker-compose logs -f livekit

# Stop everything
docker-compose down

# Clean and rebuild
rm -rf node_modules && npm install --workspaces
```

## 📋 Pre-Flight Checklist

Before demos or testing:

- [ ] Backend running (`docker-compose up`)
- [ ] Mobile app installed & running (`npm start`)
- [ ] Both devices on same WiFi
- [ ] API URLs correct in `src/App.tsx`
- [ ] Room IDs match between devices
- [ ] Check browser console for errors
- [ ] Check server terminal for [WS] logs
- [ ] Test login first
- [ ] Test room join next
- [ ] Send test message
- [ ] Check transcript updates

## 🎓 Learning Path

```
1. Read README.md (5 min)
   └─ Understand what SilentCall does

2. Run RUN.md (10 min)
   └─ Get it working locally

3. Read HOW_IT_WORKS.md (15 min)
   └─ Understand the message flow

4. Read ARCHITECTURE.md (20 min)
   └─ Understand the system design

5. Integrate a real provider
   └─ Try Google Cloud or ElevenLabs

6. Deploy to cloud
   └─ Host on Heroku or AWS
```

---

Generated: February 2026
Version: 1.0
