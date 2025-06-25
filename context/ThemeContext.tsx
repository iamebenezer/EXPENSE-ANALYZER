"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define our theme colors
const lightColors = {
  primary: "#1E88E5", // Blue
  secondary: "#FF9800", // Orange
  background: "#FFFFFF", // White
  text: "#333333",
  textLight: "#757575",
  border: "#E0E0E0",
  error: "#D32F2F",
  success: "#388E3C",
  card: "#F5F5F5",
  danger: "#E53935", // Red for destructive actions
  warning: "#FFC107", // Amber for warning states
  disabled: "#D3D3D3", // LightGray for disabled states
  switchTrack: "#E0E0E0", // Switch track color
  thumb: "#FFFFFF", // Switch thumb color
};

const darkColors = {
  primary: "#1E88E5", // Blue - Can be adjusted for dark mode
  secondary: "#FF9800", // Orange - Can be adjusted
  background: "#121212", // Dark background
  text: "#E0E0E0", // Light text
  textLight: "#A0A0A0", // Lighter grey text
  border: "#272727", // Darker border
  error: "#CF6679", // Dark mode error color
  success: "#66BB6A", // Dark mode success color
  card: "#1E1E1E", // Dark card background
  danger: "#E57373", // Dark mode danger
  warning: "#FFD54F", // Dark mode warning (lighter amber)
  disabled: "#424242", // Dark mode disabled
  switchTrack: "#424242", // Dark switch track color
  thumb: "#E0E0E0", // Dark switch thumb color
};

const commonProperties = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    xl: 24,
  },
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
};

const lightTheme = { colors: lightColors, ...commonProperties };
const darkTheme = { colors: darkColors, ...commonProperties };

export type Theme = typeof lightTheme;
export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = '@app-theme';

// Provide a default context value that matches the interface
const defaultThemeContextValue: ThemeContextValue = {
  theme: lightTheme, // Default to light theme initially
  themeMode: 'light',
  toggleTheme: () => console.warn('toggleTheme not yet implemented'),
};

const ThemeContext = createContext<ThemeContextValue>(defaultThemeContextValue);

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light'); // Default to light

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedThemeMode = await AsyncStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
        if (storedThemeMode) {
          setThemeMode(storedThemeMode);
        }
      } catch (e) {
        console.error("Failed to load theme from storage", e);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newThemeMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newThemeMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newThemeMode);
    } catch (e) {
      console.error("Failed to save theme to storage", e);
    }
  };

  const currentTheme = themeMode === 'light' ? lightTheme : darkTheme;

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, themeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
