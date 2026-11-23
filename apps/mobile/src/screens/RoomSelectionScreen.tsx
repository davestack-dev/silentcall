/**
 * Room selection/creation screen
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { useCall } from "../CallContext";

interface RoomSelectionScreenProps {
  onRoomSelected: (roomId: string, role: "caller" | "callee") => void;
}

export const RoomSelectionScreen: React.FC<RoomSelectionScreenProps> = ({
  onRoomSelected,
}) => {
  const [roomInput, setRoomInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<"caller" | "callee">(
    "callee",
  );

  const handleJoinRoom = async () => {
    const roomId =
      roomInput.trim() || `room-${Math.random().toString(36).substr(2, 9)}`;

    if (!roomId) {
      Alert.alert("Error", "Please enter or create a room ID");
      return;
    }

    onRoomSelected(roomId, selectedRole);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Join a Call</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Room Code</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter room code or leave blank to create new"
            value={roomInput}
            onChangeText={setRoomInput}
          />
          <Text style={styles.hint}>
            Share this room code with the other person to join the same call.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Role</Text>
          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                selectedRole === "callee" && styles.roleButtonActive,
              ]}
              onPress={() => setSelectedRole("callee")}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  selectedRole === "callee" && styles.roleButtonTextActive,
                ]}
              >
                Callee (Receiving)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.roleButton,
                selectedRole === "caller" && styles.roleButtonActive,
              ]}
              onPress={() => setSelectedRole("caller")}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  selectedRole === "caller" && styles.roleButtonTextActive,
                ]}
              >
                Caller (Testing)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleJoinRoom}>
          <Text style={styles.buttonText}>Join Call</Text>
        </TouchableOpacity>

        <View style={styles.info}>
          <Text style={styles.infoTitle}>How it works:</Text>
          <Text style={styles.infoText}>
            • Callee: You respond with text, the caller hears your voice via TTS
          </Text>
          <Text style={styles.infoText}>
            • Caller: You can test receiving the TTS audio responses
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
    color: "#1a1a1a",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#1a1a1a",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: "#666",
  },
  roleContainer: {
    flexDirection: "row",
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  roleButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  roleButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
  },
  roleButtonTextActive: {
    color: "#fff",
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  info: {
    backgroundColor: "#e7f3ff",
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
  },
  infoTitle: {
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: "#333",
    marginBottom: 4,
  },
});
