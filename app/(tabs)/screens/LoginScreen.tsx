"use client";

import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, Theme } from "../../../context/ThemeContext";
import { useAuth } from "../../../context/AuthContext";

const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        // Navigate to the main app screen (e.g., the root of your tabs)
        router.replace('/(tabs)'); 
      } else {
        Alert.alert("Error", "Invalid email or password");
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong. Please try again.");
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
        <View style={styles.logoContainer}>
          <Image
            source={require("../../../assets/images/logo.png")}
            style={styles.logo}
          />
          <Text style={[styles.appName, { color: theme.colors.primary }]}>
            Expense Analyzer
          </Text>
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>
          Welcome Back
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textLight }]}>
          Sign in to continue to your account
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

          <View
            style={[
              styles.inputContainer,
              { borderColor: theme.colors.border },
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={theme.colors.textLight}
            />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Password"
              placeholderTextColor={theme.colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.colors.textLight}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/screens/ForgotPasswordScreen')}
          >
            <Text
              style={[styles.forgotPassword, { color: theme.colors.primary }]}
            >
              Forgot Password?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textLight }]}>
            Don't have an account?
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/screens/SignupScreen")}
          >
            <Text style={[styles.signupText, { color: theme.colors.primary }]}>
              Sign Up
            </Text>
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
    justifyContent: "center",
    padding: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: "contain",
  },
  appName: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
  },
  formContainer: {
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  forgotPassword: {
    textAlign: "right",
    marginBottom: 20,
    fontSize: 14,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  footerText: {
    fontSize: 14,
  },
  signupText: {
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 5,
  },
});

export default LoginScreen;
