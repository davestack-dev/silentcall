/**
 * Mocked TTS Provider for MVP
 * Simulates text-to-speech by generating silent audio or placeholder data
 */

import { TTSProvider } from "@silentcall/shared";

export class MockTTSProvider implements TTSProvider {
  /**
   * Synthesize text to audio
   * Returns a minimal audio buffer (silent WAV file)
   */
  async synthesize(text: string, voiceId?: string): Promise<ArrayBuffer> {
    // Generate a simple 1-second silent WAV file based on text length
    // Duration ~ 100ms per word
    const wordCount = text.split(" ").length;
    const durationMs = Math.max(500, wordCount * 200); // Min 500ms, 200ms per word

    return this.generateSilentWAV(durationMs);
  }

  async getVoices(): Promise<
    Array<{ id: string; name: string; gender: string }>
  > {
    return [
      { id: "voice-1", name: "Alex (US)", gender: "male" },
      { id: "voice-2", name: "Victoria (US)", gender: "female" },
      { id: "voice-3", name: "James (UK)", gender: "male" },
    ];
  }

  /**
   * Generate a minimal WAV file with silence
   * This allows testing the TTS pipeline without actual audio synthesis
   */
  private generateSilentWAV(durationMs: number): ArrayBuffer {
    const sampleRate = 16000;
    const channels = 1;
    const bytesPerSample = 2;

    const frameCount = Math.floor((durationMs / 1000) * sampleRate);
    const byteRate = sampleRate * channels * bytesPerSample;
    const blockAlign = channels * bytesPerSample;
    const audioDataSize = frameCount * blockAlign;

    const buffer = new ArrayBuffer(44 + audioDataSize);
    const view = new DataView(buffer);

    // WAV file header
    // "RIFF"
    view.setUint8(0, 0x52);
    view.setUint8(1, 0x49);
    view.setUint8(2, 0x46);
    view.setUint8(3, 0x46);

    // File size - 8
    view.setUint32(4, 36 + audioDataSize, true);

    // "WAVE"
    view.setUint8(8, 0x57);
    view.setUint8(9, 0x41);
    view.setUint8(10, 0x56);
    view.setUint8(11, 0x45);

    // "fmt " subchunk
    view.setUint8(12, 0x66);
    view.setUint8(13, 0x6d);
    view.setUint8(14, 0x74);
    view.setUint8(15, 0x20);

    // Subchunk1Size (16 for PCM)
    view.setUint32(16, 16, true);

    // Audio format (1 for PCM)
    view.setUint16(20, 1, true);

    // Channels
    view.setUint16(22, channels, true);

    // Sample rate
    view.setUint32(24, sampleRate, true);

    // Byte rate
    view.setUint32(28, byteRate, true);

    // Block align
    view.setUint16(32, blockAlign, true);

    // Bits per sample
    view.setUint16(34, 16, true);

    // "data" subchunk
    view.setUint8(36, 0x64);
    view.setUint8(37, 0x61);
    view.setUint8(38, 0x74);
    view.setUint8(39, 0x61);

    // Subchunk2Size
    view.setUint32(40, audioDataSize, true);

    // Audio data is all zeros (silence)
    for (let i = 44; i < 44 + audioDataSize; i++) {
      view.setUint8(i, 0);
    }

    return buffer;
  }
}

export function createTTSProvider(): TTSProvider {
  return new MockTTSProvider();
}
