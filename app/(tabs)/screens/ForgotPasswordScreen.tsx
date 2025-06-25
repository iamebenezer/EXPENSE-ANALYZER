"use client";

import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../context/ThemeContext";
import { auth } from "../../../firebaseConfig"; // Import auth directly
import { sendPasswordResetEmail } from "firebase/auth";

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const theme = useTheme();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        "Check Your Email",
        "A password reset link has been sent to your email address if it's associated with an account."
      );
      router.back(); // Go back to the login screen
    } catch (error: any) {
      console.error("Password reset error", error);
      // You can check error.code for more specific Firebase errors
      // e.g., 'auth/user-not-found'
      Alert.alert("Error", "Failed to send password reset email. Please check the email address and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: theme.colors.text }]}>
          Forgot Password?
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textLight }]}>
          Enter your email address and we'll send you a link to reset your password.
        </Text>

        <View style={styles.formContainer}>
          <View
            style={[
              styles.inputContainer,
              { borderColor: theme.colors.border },
            ]}
          >
            <Ionicons
              name="mail-outline"
              size={20}
              color={theme.colors.textLight}
            />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Email"
              placeholderTextColor={theme.colors.textLight}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={handleResetPassword}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Send Reset Email</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    padding: 20,
  },
  backButton: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 20 : 20, // Adjust based on SafeAreaView if needed
    left: 20,
    zIndex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
    marginTop: 60, // Give space for back button
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: "center",
    color: "#666",
  },
  formContainer: {
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === "ios" ? 15 : 10,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default ForgotPasswordScreen;
