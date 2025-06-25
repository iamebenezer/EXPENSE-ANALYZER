"use client";

import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";

import OnboardingScreen from "./screens/OnboardingScreen";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import MainNavigator from "@/navigation/MainNavigator";
import { useAuth } from "@/context/AuthContext";

export default function App() {
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem("hasLaunched").then((value) => {
      if (value === null) {
        AsyncStorage.setItem("hasLaunched", "true");
        setIsFirstLaunch(true);
      } else {
        setIsFirstLaunch(false);
      }
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  // Conditionally render components based on user login status and onboarding
  if (!user) {
    if (isFirstLaunch) {
      return <OnboardingScreen />;
    }
    return <LoginScreen />;
  }

  return <MainNavigator />;
}
