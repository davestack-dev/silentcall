/**
 * Simple WebRTC audio handler for SilentCall
 * Manages local audio stream and injection of TTS audio
 */

import {
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
  RTCIceCandidate,
} from "react-native-webrtc";

export interface WebRTCConfig {
  iceServers?: Array<{ urls: string[] }>;
}

export class WebRTCAudioHandler {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: any = null;
  private audioContext: any = null;
  private config: WebRTCConfig;

  constructor(config?: WebRTCConfig) {
    this.config = config || {
      iceServers: [
        { urls: ["stun:stun.l.google.com:19302"] },
        { urls: ["stun:stun1.l.google.com:19302"] },
      ],
    };
  }

  /**
   * Initialize local audio stream
   */
  async initializeLocalStream(): Promise<void> {
    try {
      this.localStream = await mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            minFrameRate: 15,
            maxFrameRate: 30,
          },
        },
        video: false,
      });
      console.log("[WebRTC] Local audio stream initialized");
    } catch (err) {
      console.error("[WebRTC] Error getting user media:", err);
      throw err;
    }
  }

  /**
   * Create peer connection
   */
  createPeerConnection(): RTCPeerConnection {
    if (this.peerConnection) {
      return this.peerConnection;
    }

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers || [
        { urls: ["stun:stun.l.google.com:19302"] },
      ],
    });

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => {
        this.peerConnection!.addTrack(track, this.localStream);
      });
    }

    this.peerConnection.onaddstream = (event: any) => {
      console.log("[WebRTC] Received remote stream");
    };

    this.peerConnection.onicecandidate = (event: any) => {
      if (event.candidate) {
        console.log("[WebRTC] ICE candidate:", event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log(
        "[WebRTC] Connection state:",
        this.peerConnection?.connectionState,
      );
    };

    return this.peerConnection;
  }

  /**
   * Create offer (for initiating call)
   */
  async createOffer(): Promise<RTCSessionDescription> {
    if (!this.peerConnection) {
      throw new Error("PeerConnection not initialized");
    }

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Set remote description
   */
  async setRemoteDescription(description: any): Promise<void> {
    if (!this.peerConnection) {
      throw new Error("PeerConnection not initialized");
    }

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(description),
    );
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(candidate: any): Promise<void> {
    if (!this.peerConnection && candidate) {
      await this.peerConnection!.addIceCandidate(
        new RTCIceCandidate(candidate),
      );
    }
  }

  /**
   * Get connection state
   */
  getConnectionState(): string {
    return this.peerConnection?.connectionState || "disconnected";
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    // Stop local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => {
        track.stop();
      });
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.localStream = null;
  }
}
