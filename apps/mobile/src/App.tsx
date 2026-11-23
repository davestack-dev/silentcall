/**
 * Main app component for SilentCall
 */

import React, { useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
  View,
} from "react-native";
import { LoginScreen } from "./screens/LoginScreen";
import { RoomSelectionScreen } from "./screens/RoomSelectionScreen";
import { CallScreen } from "./screens/CallScreen";
import { CallProvider, useCall } from "./CallContext";

/**
 * App state machine:
 * 1. login: Show LoginScreen
 * 2. roomSelection: Show RoomSelectionScreen
 * 3. call: Show CallScreen (user is in a room)
 */
type AppState = "login" | "roomSelection" | "call";

const AppContent: React.FC = () => {
  const [appState, setAppState] = useState<AppState>("login");
  const { isAuthenticated, roomId, logout } = useCall();

  // Update state based on context changes
  React.useEffect(() => {
    if (!isAuthenticated) {
      setAppState("login");
    } else if (roomId) {
      setAppState("call");
    } else {
      setAppState("roomSelection");
    }
  }, [isAuthenticated, roomId]);

  const handleRoomSelected = async (rid: string, role: "caller" | "callee") => {
    const { joinRoom } = useCall();
    await joinRoom(rid, role);
  };

  const handleLogout = () => {
    logout();
    setAppState("login");
  };

  return (
    <SafeAreaView style={styles.container}>
      {appState === "login" && <LoginScreen />}
      {appState === "roomSelection" && (
        <RoomSelectionScreen onRoomSelected={handleRoomSelected} />
      )}
      {appState === "call" && <CallScreen />}
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <CallProvider apiUrl="http://localhost:8080" wsUrl="ws://localhost:8080">
      <AppContent />
    </CallProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
});
