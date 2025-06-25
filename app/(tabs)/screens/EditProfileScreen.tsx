"use client";
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { useTheme, Theme } from '../../../context/ThemeContext';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 25,
  },
  saveButton: {
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50, 
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

const EditProfileScreen = () => {
  const { user, updateUserProfile } = useAuth(); 
  const { theme } = useTheme(); 
  const styles = getStyles(theme);
  const router = useRouter();

  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
    }
  }, [user]);

  const handleSaveChanges = async () => {
    if (!user) {
      Alert.alert("Error", "No user session found.");
      return;
    }
    if (name.trim() === '') {
      Alert.alert("Validation Error", "Name cannot be empty.");
      return;
    }
    if (name.trim() === user.name) {
      Alert.alert("No Changes", "You haven't made any changes to your name.");
      return;
    }

    setIsSaving(true);
    const success = await updateUserProfile({ name: name.trim() });
    setIsSaving(false);

    if (success) {
      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } else {
      Alert.alert("Error", "Failed to update profile. Please try again.");
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen 
        options={{
          title: 'Edit Profile',
          headerStyle: {
            backgroundColor: theme.colors.background,
          },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
        }}
      />
      <View style={styles.content}>
        <Text style={[styles.label, { color: theme.colors.textLight }]}>Name</Text>
        <TextInput
          style={[
            styles.input,
            { 
              backgroundColor: theme.colors.card, 
              color: theme.colors.text, 
              borderColor: theme.colors.border 
            }
          ]}
          value={name}
          onChangeText={setName}
          placeholder="Enter your full name"
          placeholderTextColor={theme.colors.textLight}
          editable={!isSaving}
        />

        <TouchableOpacity 
          style={[
            styles.saveButton,
            { backgroundColor: isSaving ? theme.colors.disabled : theme.colors.primary }
          ]}
          onPress={handleSaveChanges}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default EditProfileScreen;
