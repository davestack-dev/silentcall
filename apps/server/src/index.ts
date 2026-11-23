/**
 * Main Express + WebSocket Server for SilentCall
 * Handles authentication, room management, transcript streaming, and TTS requests
 */

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import {
  WSMessage,
  RoomJoinPayload,
  MessageSentPayload,
  TTSRequestPayload,
  TranscriptPartialPayload,
  TranscriptFinalPayload,
  RoomJoinedPayload,
  TTSResponsePayload,
  ChatMessage,
} from "@silentcall/shared";
import { RoomManager } from "./room";
import { createTTSProvider } from "./tts.mock";

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 8080;
const LIVEKIT_URL = process.env.LIVEKIT_URL || "ws://localhost:7880";
const TTS_PROVIDER = process.env.TTS_PROVIDER || "mock"; // "mock" | "google" | "openai"

// ============================================================================
// SETUP
// ============================================================================

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const roomManager = new RoomManager();
const ttsProvider = createTTSProvider();

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// REST ENDPOINTS
// ============================================================================

/**
 * Health check
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

/**
 * Generate dev auth token
 * In production, this would validate credentials against a user database
 */
app.post("/api/auth/dev-login", (req, res) => {
  const { deviceId, name } = req.body;

  if (!deviceId || !name) {
    return res.status(400).json({ error: "deviceId and name required" });
  }

  const token = Buffer.from(
    JSON.stringify({
      userId: `user-${uuidv4()}`,
      deviceId,
      name,
      iat: Date.now(),
    }),
  ).toString("base64");

  res.json({
    token,
    userId: `user-${uuidv4()}`,
    expiresIn: 86400,
  });
});

/**
 * Get available TTS voices
 */
app.get("/api/tts/voices", async (req, res) => {
  try {
    const voices = await ttsProvider.getVoices();
    res.json(voices);
  } catch (err: any) {
    console.error("Error fetching voices:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Health check for TTS service
 */
app.get("/api/tts/health", (req, res) => {
  res.json({
    provider: TTS_PROVIDER,
    status: "ready",
  });
});

/**
 * Get active rooms (for debugging)
 */
app.get("/api/rooms", (req, res) => {
  const rooms = roomManager.getAllRooms();
  res.json(rooms);
});

// ============================================================================
// WEBSOCKET HANDLERS
// ============================================================================

wss.on("connection", (ws) => {
  console.log("[WS] Client connected");

  // Send auth challenge
  const challenge: WSMessage = {
    type: "auth:init",
    payload: { challenge: uuidv4() },
    timestamp: Date.now(),
  };
  ws.send(JSON.stringify(challenge));

  // =========================================================================
  // MESSAGE HANDLER
  // =========================================================================

  ws.on("message", async (data: string) => {
    try {
      const msg: WSMessage = JSON.parse(data);
      console.log(`[WS] Received: ${msg.type}`);

      const client = roomManager["clients"]?.get(ws);

      switch (msg.type) {
        // --- Authentication ---
        case "auth:init": {
          const { token } = msg.payload;
          if (!token) {
            ws.send(
              JSON.stringify({
                type: "error",
                payload: { code: "AUTH_FAILED", message: "No token" },
                timestamp: Date.now(),
              }),
            );
            break;
          }

          try {
            // Decode base64 token (dev login)
            const decoded = JSON.parse(Buffer.from(token, "base64").toString());
            const { userId, name, deviceId } = decoded;

            roomManager.registerClient(ws, userId, name);
            console.log(`[WS] Client authenticated: ${userId}`);

            ws.send(
              JSON.stringify({
                type: "auth:ready",
                payload: { userId, name },
                timestamp: Date.now(),
              }),
            );
          } catch (err) {
            ws.send(
              JSON.stringify({
                type: "error",
                payload: {
                  code: "AUTH_FAILED",
                  message: "Invalid token format",
                },
                timestamp: Date.now(),
              }),
            );
          }
          break;
        }

        // --- Room Management ---
        case "room:join": {
          if (!client) {
            ws.send(
              JSON.stringify({
                type: "error",
                payload: {
                  code: "NOT_AUTH",
                  message: "Not authenticated",
                },
                timestamp: Date.now(),
              }),
            );
            break;
          }

          const payload = msg.payload as RoomJoinPayload;
          const room = roomManager.joinRoom(ws, payload.roomId, payload.role);

          if (room) {
            // Send room:joined to the joining client
            ws.send(
              JSON.stringify({
                type: "room:joined",
                payload: {
                  roomId: room.roomId,
                  participants: room.participants,
                  liveKitUrl: LIVEKIT_URL,
                } as RoomJoinedPayload,
                timestamp: Date.now(),
              }),
            );

            // Broadcast history
            const transcriptHistory = roomManager.getTranscriptHistory(
              room.roomId,
            );
            transcriptHistory.forEach((evt) => {
              ws.send(
                JSON.stringify({
                  type: evt.partial ? "transcript:partial" : "transcript:final",
                  payload: evt,
                  timestamp: Date.now(),
                }),
              );
            });

            const chatHistory = roomManager.getChatHistory(room.roomId);
            chatHistory.forEach((msg) => {
              ws.send(
                JSON.stringify({
                  type: "message:sent",
                  payload: { message: msg } as MessageSentPayload,
                  timestamp: Date.now(),
                }),
              );
            });

            console.log(
              `[WS] Client joined room: ${payload.roomId} as ${payload.role}`,
            );
          }
          break;
        }

        case "room:leave": {
          if (client?.roomId) {
            roomManager.leaveRoom(ws, client.roomId);
          }
          break;
        }

        // --- Chat & Messages ---
        case "message:send": {
          const payload = msg.payload as MessageSentPayload;
          const { message } = payload;

          if (client?.roomId) {
            roomManager.addChatMessage(client.roomId, message);

            // If TTS not already sent, request it
            if (!message.ttsSent) {
              // Emit TTS request to queue
              console.log(
                `[TTS] Processing message: "${message.text.substring(0, 50)}..."`,
              );

              // In a real app, you'd queue this for async processing
              // For now, generate sync and send immediately
              try {
                const audioBuffer = await ttsProvider.synthesize(
                  message.text,
                  "voice-1",
                );
                const base64Audio = Buffer.from(audioBuffer).toString("base64");

                const ttsResponse: TTSResponsePayload = {
                  messageId: message.id,
                  audio: base64Audio,
                  format: "audio/wav",
                  durationMs: 1000,
                };

                roomManager.broadcastTTSResponse(client.roomId, ttsResponse);
                console.log(
                  `[TTS] Sent audio for message: ${message.id.substring(0, 8)}`,
                );
              } catch (err: any) {
                console.error("TTS error:", err);
              }
            }
          }
          break;
        }

        // --- Transcript (Streaming STT) ---
        case "transcript:partial": {
          const payload = msg.payload as TranscriptPartialPayload;
          if (client?.roomId) {
            roomManager.addTranscript(client.roomId, {
              messageId: payload.messageId,
              speaker: payload.speaker,
              content: payload.content,
              partial: true,
              timestamp: payload.timestamp,
            });
          }
          break;
        }

        case "transcript:final": {
          const payload = msg.payload as TranscriptFinalPayload;
          if (client?.roomId) {
            roomManager.addTranscript(client.roomId, {
              messageId: payload.messageId,
              speaker: payload.speaker,
              content: payload.content,
              partial: false,
              timestamp: payload.timestamp,
            });
          }
          break;
        }

        // --- TTS (Client-side TTS completion notification) ---
        case "tts:request": {
          const payload = msg.payload as TTSRequestPayload;
          console.log(`[TTS] Client request for message: ${payload.messageId}`);

          if (client?.roomId) {
            try {
              const audioBuffer = await ttsProvider.synthesize(
                payload.text,
                payload.voiceId,
              );
              const base64Audio = Buffer.from(audioBuffer).toString("base64");

              const ttsResponse: TTSResponsePayload = {
                messageId: payload.messageId,
                audio: base64Audio,
                format: "audio/wav",
                durationMs: 1000,
              };

              roomManager.broadcastTTSResponse(client.roomId, ttsResponse);
            } catch (err: any) {
              console.error("TTS error:", err);
              ws.send(
                JSON.stringify({
                  type: "error",
                  payload: {
                    code: "TTS_FAILED",
                    message: err.message,
                  },
                  timestamp: Date.now(),
                }),
              );
            }
          }
          break;
        }

        default:
          console.warn(`[WS] Unknown message type: ${msg.type}`);
      }
    } catch (err: any) {
      console.error("[WS] Error handling message:", err);
      ws.send(
        JSON.stringify({
          type: "error",
          payload: { code: "SERVER_ERROR", message: err.message },
          timestamp: Date.now(),
        }),
      );
    }
  });

  // =========================================================================
  // DISCONNECT HANDLER
  // =========================================================================

  ws.on("close", () => {
    console.log("[WS] Client disconnected");
    roomManager.unregisterClient(ws);
  });

  ws.on("error", (err) => {
    console.error("[WS] Error:", err);
  });
});

// ============================================================================
// SERVER START
// ============================================================================

httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    SilentCall Server Ready                    ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  HTTP Server:  http://localhost:${PORT}
║  WebSocket:    ws://localhost:${PORT}
║  LiveKit:      ${LIVEKIT_URL}
║  TTS Provider: ${TTS_PROVIDER}
║                                                                ║
║  Endpoints:                                                    ║
║  • POST /api/auth/dev-login           (Dev login)             ║
║  • GET  /api/tts/voices               (Available voices)      ║
║  • GET  /api/rooms                    (Active rooms)          ║
║  • GET  /health                       (Health check)          ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
