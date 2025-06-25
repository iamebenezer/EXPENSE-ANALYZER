"use client";

import { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../context/ThemeContext";
import { useAuth } from "../../../context/AuthContext";

const SignupScreen = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { theme } = useTheme(); // Changed this line
  const { signup } = useAuth();

  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const success = await signup(name, email, password);
      if (success) {
        router.replace('/(tabs)');
      } else {
        Alert.alert("Error", "Email already in use or registration failed");
        setIsLoading(false);
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong. Please try again.");
      setIsLoading(false);
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
      
        
        <ScrollView showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
     
  
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Create Account
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textLight }]}>
            Sign up to start tracking your finances
          </Text>

          <View style={styles.formContainer}>
            <View
              style={[
                styles.inputContainer,
                { borderColor: theme.colors.border },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={theme.colors.textLight}
              />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Full Name"
                placeholderTextColor={theme.colors.textLight}
                value={name}
                onChangeText={setName}
              />
            </View>

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
                placeholder="Confirm Password"
                placeholderTextColor={theme.colors.textLight}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={theme.colors.textLight}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.primary }]}
              onPress={handleSignup}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text
              style={[styles.footerText, { color: theme.colors.textLight }]}
            >
              Already have an account?
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/screens/LoginScreen")}
            >
              <Text style={[styles.loginText, { color: theme.colors.primary }]}>
                Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    marginTop: 10,
    marginBottom: 20,
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
  button: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
  },
  loginText: {
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 5,
  },
});

export default SignupScreen;
