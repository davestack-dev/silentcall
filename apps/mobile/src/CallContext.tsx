/**
 * Context for managing call state, authentication, and WebSocket connection
 */

import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { WSClient } from "../ws-client";
import {
  ChatMessage,
  TranscriptEvent,
  TranscriptMessage,
  TTSResponsePayload,
} from "@silentcall/shared";
import { v4 as uuidv4 } from "uuid";

export interface CallContextType {
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
  participants: any[];
  joinRoom: (roomId: string, role: "caller" | "callee") => Promise<void>;
  leaveRoom: () => void;

  // Chat & Messages
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<void>;

  // Transcript
  transcriptHistory: TranscriptMessage[];
  currentTranscript: string;
  addTranscriptPartial: (speaker: "caller" | "callee", content: string) => void;
  addTranscriptFinal: (speaker: "caller" | "callee", content: string) => void;

  // TTS Audio
  ttsAudioBuffer: Map<string, ArrayBuffer>;
  receiveTTSAudio: (messageId: string, audio: ArrayBuffer) => void;

  // Quick replies
  sendQuickReply: (text: string) => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export interface CallProviderProps {
  children: React.ReactNode;
  apiUrl: string;
  wsUrl: string;
}

export const CallProvider: React.FC<CallProviderProps> = ({
  children,
  apiUrl,
  wsUrl,
}) => {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const wsClientRef = useRef<WSClient | null>(null);

  // Room state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Transcript state
  const [transcriptHistory, setTranscriptHistory] = useState<
    TranscriptMessage[]
  >([]);
  const [currentTranscript, setCurrentTranscript] = useState<string>("");

  // TTS audio buffer
  const [ttsAudioBuffer, setTtsAudioBuffer] = useState<
    Map<string, ArrayBuffer>
  >(new Map());

  /**
   * Login with device info (dev login)
   */
  const login = useCallback(
    async (deviceId: string, name: string) => {
      try {
        // Call dev-login endpoint
        const response = await fetch(`${apiUrl}/api/auth/dev-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, name }),
        });

        if (!response.ok) throw new Error("Login failed");

        const data = await response.json();
        setToken(data.token);
        setUserId(data.userId);

        // Connect WebSocket
        if (!wsClientRef.current) {
          wsClientRef.current = new WSClient({ url: wsUrl });
        }

        await wsClientRef.current.connect();
        setIsConnected(true);

        // Authenticate with token
        await wsClientRef.current.authenticate(data.token);
        setIsAuthenticated(true);

        // Register event handlers
        _registerEventHandlers(wsClientRef.current);

        console.log("[CallContext] Login successful");
      } catch (err) {
        console.error("[CallContext] Login failed:", err);
        throw err;
      }
    },
    [apiUrl, wsUrl],
  );

  /**
   * Logout
   */
  const logout = useCallback(() => {
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
      wsClientRef.current = null;
    }
    setIsAuthenticated(false);
    setUserId(null);
    setToken(null);
    setIsConnected(false);
    setRoomId(null);
    setParticipants([]);
    setMessages([]);
    setTranscriptHistory([]);
  }, []);

  /**
   * Join a room
   */
  const joinRoom = useCallback(
    async (rid: string, role: "caller" | "callee") => {
      if (!wsClientRef.current || !isAuthenticated) {
        throw new Error("Not authenticated");
      }

      setRoomId(rid);
      wsClientRef.current.send("room:join", {
        roomId: rid,
        userId,
        userName: "Me", // TODO: use actual name
        role,
      });
    },
    [isAuthenticated, userId],
  );

  /**
   * Leave room
   */
  const leaveRoom = useCallback(() => {
    if (wsClientRef.current && roomId) {
      wsClientRef.current.send("room:leave", { roomId });
    }
    setRoomId(null);
    setParticipants([]);
    setMessages([]);
    setTranscriptHistory([]);
  }, [roomId]);

  /**
   * Send a message (text)
   */
  const sendMessage = useCallback(
    async (text: string) => {
      if (!wsClientRef.current || !roomId || !userId) {
        throw new Error("Not ready to send");
      }

      const message: ChatMessage = {
        id: uuidv4(),
        senderId: "callee",
        senderName: "Me",
        text,
        timestamp: Date.now(),
        ttsSent: false,
      };

      // Broadcast to room
      wsClientRef.current.send("message:send", { message });

      // Add to local state
      setMessages((prev) => [...prev, message]);
    },
    [roomId, userId],
  );

  /**
   * Send quick reply
   */
  const sendQuickReply = useCallback(
    (text: string) => {
      return sendMessage(text);
    },
    [sendMessage],
  );

  /**
   * Add partial transcript
   */
  const addTranscriptPartial = useCallback(
    (speaker: "caller" | "callee", content: string) => {
      setCurrentTranscript(content);
      // Partial transcripts are shown inline but not added to history yet
    },
    [],
  );

  /**
   * Add final transcript
   */
  const addTranscriptFinal = useCallback(
    (speaker: "caller" | "callee", content: string) => {
      const evt: TranscriptMessage = {
        id: uuidv4(),
        speaker,
        content,
        partial: false,
        timestamp: Date.now(),
      };
      setTranscriptHistory((prev) => [...prev, evt]);
      setCurrentTranscript("");
    },
    [],
  );

  /**
   * Receive TTS audio
   */
  const receiveTTSAudio = useCallback(
    (messageId: string, audio: ArrayBuffer) => {
      setTtsAudioBuffer((prev) => new Map(prev).set(messageId, audio));
    },
    [],
  );

  /**
   * Register WebSocket event handlers
   */
  const _registerEventHandlers = useCallback(
    (ws: WSClient) => {
      // Room events
      ws.on("room:joined", (payload: any) => {
        console.log("[CallContext] Room joined:", payload);
        setParticipants(payload.participants);
      });

      ws.on("participant:joined", (payload: any) => {
        console.log("[CallContext] Participant joined:", payload);
        setParticipants((prev) => [...prev, payload.participant]);
      });

      ws.on("participant:left", (payload: any) => {
        console.log("[CallContext] Participant left:", payload);
        setParticipants((prev) =>
          prev.filter((p) => p.userId !== payload.userId),
        );
      });

      // Transcript events
      ws.on("transcript:partial", (payload: any) => {
        addTranscriptPartial(payload.speaker, payload.content);
      });

      ws.on("transcript:final", (payload: any) => {
        addTranscriptFinal(payload.speaker, payload.content);
      });

      // Chat events
      ws.on("message:sent", (payload: any) => {
        const { message } = payload;
        setMessages((prev) => [...prev, message]);
      });

      // TTS events
      ws.on("tts:response", (payload: TTSResponsePayload) => {
        console.log("[CallContext] Received TTS audio for:", payload.messageId);
        const audioBuffer = Buffer.from(payload.audio, "base64");
        receiveTTSAudio(payload.messageId, audioBuffer.buffer);
      });

      // Error events
      ws.on("error", (payload: any) => {
        console.error("[CallContext] Server error:", payload);
      });
    },
    [addTranscriptPartial, addTranscriptFinal, receiveTTSAudio],
  );

  const contextValue: CallContextType = {
    isAuthenticated,
    userId,
    token,
    login,
    logout,
    isConnected,
    wsClient: wsClientRef.current,
    roomId,
    participants,
    joinRoom,
    leaveRoom,
    messages,
    sendMessage,
    transcriptHistory,
    currentTranscript,
    addTranscriptPartial,
    addTranscriptFinal,
    ttsAudioBuffer,
    receiveTTSAudio,
    sendQuickReply,
  };

  return (
    <CallContext.Provider value={contextValue}>{children}</CallContext.Provider>
  );
};

export const useCall = () => {
  const context = React.useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within CallProvider");
  }
  return context;
};
