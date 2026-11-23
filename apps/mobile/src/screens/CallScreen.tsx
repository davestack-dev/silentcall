/**
 * Main call screen with chat, transcript, and quick replies
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { DEFAULT_QUICK_REPLIES } from "@silentcall/shared";
import { useCall } from "../CallContext";

export const CallScreen: React.FC = () => {
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const flatListRef = useRef<FlatList>(null);

  const {
    roomId,
    messages,
    sendMessage,
    sendQuickReply,
    transcriptHistory,
    currentTranscript,
    participants,
  } = useCall();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    setIsSending(true);
    try {
      await sendMessage(messageText);
      setMessageText("");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickReply = async (text: string) => {
    setIsSending(true);
    try {
      await sendQuickReply(text);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsSending(false);
    }
  };

  const transcriptDisplay = transcriptHistory
    .map((evt) => `${evt.speaker}: ${evt.content}`)
    .join("\n");

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Call Active</Text>
        <Text style={styles.headerSubtitle}>
          Room: {roomId?.substring(0, 8)}... | {participants.length}{" "}
          participant(s)
        </Text>
      </View>

      {/* Transcript Section */}
      <View style={styles.transcriptSection}>
        <Text style={styles.transcriptLabel}>Live Transcript</Text>
        <ScrollView style={styles.transcriptBox}>
          <Text style={styles.transcriptText}>
            {transcriptDisplay || "Waiting for caller..."}
          </Text>
          {currentTranscript && (
            <Text style={styles.transcriptPartial}>
              {currentTranscript}
              <Text style={styles.cursor}>|</Text>
            </Text>
          )}
        </ScrollView>
      </View>

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.senderId === "callee"
                ? styles.messageBubbleMe
                : styles.messageBubbleOther,
            ]}
          >
            <Text style={styles.messageSender}>
              {item.senderId === "callee" ? "You" : "Caller"}
            </Text>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.messageTime}>
              {new Date(item.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        )}
        style={styles.messageList}
        scrollEnabled={false}
      />

      {/* Quick Replies */}
      <View style={styles.quickReplies}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {DEFAULT_QUICK_REPLIES.map((reply) => (
            <TouchableOpacity
              key={reply.id}
              style={styles.quickReplyButton}
              onPress={() => handleQuickReply(reply.text)}
              disabled={isSending}
            >
              <Text style={styles.quickReplyText}>{reply.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Input Section */}
      <View style={styles.inputSection}>
        <TextInput
          style={styles.input}
          placeholder="Type your reply..."
          value={messageText}
          onChangeText={setMessageText}
          editable={!isSending}
          multiline
          maxLength={200}
        />
        <TouchableOpacity
          style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={isSending || !messageText.trim()}
        >
          {isSending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Privacy Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          ⓘ Transcription is enabled. Inform the caller.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingTop: 40, // Account for status bar
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#dbeafe",
    marginTop: 4,
  },
  transcriptSection: {
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  transcriptBox: {
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    padding: 10,
    maxHeight: 100,
  },
  transcriptText: {
    fontSize: 13,
    color: "#333",
    lineHeight: 18,
  },
  transcriptPartial: {
    fontSize: 13,
    color: "#3b82f6",
    fontStyle: "italic",
    marginTop: 4,
  },
  cursor: {
    color: "#3b82f6",
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: Dimensions.get("window").height * 0.25,
  },
  messageBubble: {
    marginVertical: 6,
    marginHorizontal: 8,
    padding: 10,
    borderRadius: 8,
    maxWidth: "85%",
  },
  messageBubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: "#2563eb",
  },
  messageBubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: "#e5e7eb",
  },
  messageSender: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
    color: "#666",
  },
  messageText: {
    fontSize: 14,
    color: "#1a1a1a",
  },
  messageTextMe: {
    color: "#fff",
  },
  messageTime: {
    fontSize: 10,
    color: "#999",
    marginTop: 4,
  },
  quickReplies: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  quickReplyButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 6,
  },
  quickReplyText: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "500",
  },
  inputSection: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    backgroundColor: "#f9f9f9",
  },
  sendButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  banner: {
    backgroundColor: "#fef3c7",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#f59e0b",
  },
  bannerText: {
    fontSize: 12,
    color: "#92400e",
    textAlign: "center",
  },
});
