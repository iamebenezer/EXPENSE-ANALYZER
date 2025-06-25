"use client";

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { Category } from '../../../models/types';

const AddCategoryScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(''); // Optional: for icon name e.g., 'fast-food-outline'
  const [color, setColor] = useState('#4A90E2'); // Default color
  const [isLoading, setIsLoading] = useState(false);
  
  // Predefined colors for categories
  const predefinedColors = [
    '#4A90E2', // Blue
    '#50E3C2', // Teal
    '#FF9500', // Orange
    '#FF2D55', // Pink
    '#5856D6', // Purple
    '#FF3B30', // Red
    '#4CD964', // Green
    '#FFCC00'  // Yellow
  ];

  const handleAddCategory = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to add a category.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a category name.');
      return;
    }

    setIsLoading(true);
    try {
      // Check if category with the same name already exists for this user or as a default
      /*
      const categoriesRef = collection(db, 'categories');
      const q = query(categoriesRef, 
        where('name', '==', name.trim()),
        // Check against user's categories OR default categories
        // This logic might need refinement based on how strictly unique names should be
        // For now, let's assume names should be unique per user, and distinct from default ones if user tries to create one with same name.
        // A simpler approach: just check if user already has one with this name.
        where('userId', '==', user.uid) 
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        Alert.alert('Error', 'A category with this name already exists.');
        setIsLoading(false);
        return;
      }
      */

      const newCategory: Omit<Category, 'id' | 'createdAt' | 'updatedAt'> & { userId: string; createdAt: any; updatedAt: any; isDefault: boolean } = {
        userId: user.uid,
        name: name.trim(),
        icon: icon.trim() || '', // Changed from || undefined to || ''
        color: color, // Add the selected color
        isDefault: false, // User-created categories are not default
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'categories'), newCategory);
      Alert.alert('Success', 'Category added successfully!');
      router.back();
    } catch (error) {
      console.error('Error adding category:', error);
      Alert.alert('Error', 'Failed to add category. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Add New Category</Text>
            <View style={{ width: 24 }} />{/* Spacer */}
          </View>

          <View style={styles.formElement}>
            <Text style={[styles.label, { color: theme.colors.textLight }]}>Category Name</Text>
            <TextInput
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
              placeholder="e.g., Groceries, Utilities"
              placeholderTextColor={theme.colors.textLight}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.formElement}>
            <Text style={[styles.label, { color: theme.colors.textLight }]}>Icon Name (Optional)</Text>
            <TextInput
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
              placeholder="e.g., 'cart-outline' (from Ionicons)"
              placeholderTextColor={theme.colors.textLight}
              value={icon}
              onChangeText={setIcon}
              autoCapitalize="none"
            />
            <Text style={[styles.iconHelperText, { color: theme.colors.textLight }]}>
              Refer to Ionicons directory for names. Leave blank for a default icon.
            </Text>
          </View>

          <View style={styles.formElement}>
            <Text style={[styles.label, { color: theme.colors.textLight }]}>Category Color</Text>
            <View style={styles.colorContainer}>
              {predefinedColors.map((colorOption) => (
                <TouchableOpacity
                  key={colorOption}
                  style={[
                    styles.colorOption,
                    { backgroundColor: colorOption },
                    color === colorOption && styles.selectedColorOption
                  ]}
                  onPress={() => setColor(colorOption)}
                />
              ))}
            </View>
            <View style={[styles.colorPreview, { backgroundColor: color }]}>
              <Text style={styles.colorPreviewText}>Selected Color</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]} 
            onPress={handleAddCategory}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Save Category</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 50, 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    padding: 5, 
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  formElement: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 15 : 10,
    fontSize: 16,
  },
  iconHelperText: {
    fontSize: 12,
    marginTop: 5,
  },
  saveButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  colorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    justifyContent: 'space-between',
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 10,
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  colorPreview: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  colorPreviewText: {
    color: 'white', // This is intentionally white for contrast against colored background
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default AddCategoryScreen;
