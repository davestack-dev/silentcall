/**
 * Mocked STT Provider for MVP
 * Simulates speech-to-text by generating plausible transcript updates
 */

import { STTProvider } from "@silentcall/shared";

export class MockSTTProvider implements STTProvider {
  private transcript: string = "";
  private isStreaming: boolean = false;
  private callback?: (partial: string, final: string, isFinal: boolean) => void;
  private partialWords: string[] = [];
  private simulationInterval?: NodeJS.Timeout;

  // Sample phrases to simulate transcription
  private samplePhrases = [
    "Hi, can you hear me?",
    "Are you there?",
    "This is a test call",
    "Please send me the files",
    "Can we reschedule?",
    "What time works for you?",
    "Thanks for calling",
    "I'll send you an email",
    "Let's meet tomorrow",
    "Sounds good to me",
  ];

  async startStream(): Promise<void> {
    this.isStreaming = true;
    this.transcript = "";
    this.partialWords = [];
    this.simulateTranscription();
  }

  async stopStream(): Promise<void> {
    this.isStreaming = false;
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
    // Finalize any partial transcript
    if (this.callback && this.partialWords.length > 0) {
      const finalText = this.partialWords.join(" ");
      this.transcript = finalText;
      this.callback(finalText, finalText, true);
      this.partialWords = [];
    }
  }

  async processAudio(audioChunk: ArrayBuffer): Promise<void> {
    // In a real implementation, this would send audio to STT provider.
    // For mocking, we ignore this and rely on simulateTranscription.
  }

  getTranscript(): string {
    return this.transcript;
  }

  onTranscript(
    callback: (partial: string, final: string, isFinal: boolean) => void,
  ): void {
    this.callback = callback;
  }

  /**
   * Simulate transcription by generating word-by-word updates
   */
  private simulateTranscription(): void {
    // Pick a random phrase
    const phrase =
      this.samplePhrases[Math.floor(Math.random() * this.samplePhrases.length)];
    const words = phrase.split(" ");

    let wordIndex = 0;

    this.simulationInterval = setInterval(() => {
      if (!this.isStreaming || wordIndex >= words.length) {
        if (this.simulationInterval) clearInterval(this.simulationInterval);
        if (wordIndex > 0 && this.callback) {
          const final = words.slice(0, wordIndex).join(" ");
          this.transcript = final;
          this.callback(final, final, true);
        }
        return;
      }

      // Add next word
      this.partialWords.push(words[wordIndex]);
      const partialText = this.partialWords.join(" ");
      this.transcript = partialText;

      if (this.callback) {
        this.callback(partialText, partialText, false);
      }

      wordIndex++;
    }, 300); // New word every 300ms
  }
}

export function createSTTProvider(): STTProvider {
  return new MockSTTProvider();
}
