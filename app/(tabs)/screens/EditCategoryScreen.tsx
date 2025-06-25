"use client";

import React, { useState, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../firebaseConfig';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { Category } from '../../../models/types';

const EditCategoryScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!categoryId || !user) {
      Alert.alert('Error', 'Category ID is missing or user not logged in.');
      router.back();
      return;
    }

    const fetchCategory = async () => {
      setIsFetching(true);
      try {
        const categoryDocRef = doc(db, 'categories', categoryId);
        const categorySnap = await getDoc(categoryDocRef);

        if (categorySnap.exists()) {
          const categoryData = categorySnap.data() as Category;
          // Ensure only user's own categories can be edited (or handle default categories appropriately)
          if (categoryData.userId !== user.uid || categoryData.isDefault) {
            Alert.alert('Error', 'This category cannot be edited.');
            router.back();
            return;
          }
          setName(categoryData.name);
          setOriginalName(categoryData.name);
          setIcon(categoryData.icon || '');
        } else {
          Alert.alert('Error', 'Category not found.');
          router.back();
        }
      } catch (error) {
        console.error('Error fetching category:', error);
        Alert.alert('Error', 'Failed to fetch category details.');
        router.back();
      } finally {
        setIsFetching(false);
      }
    };

    fetchCategory();
  }, [categoryId, user, router]);

  const handleUpdateCategory = async () => {
    if (!user || !categoryId) {
      Alert.alert('Error', 'User not logged in or Category ID missing.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a category name.');
      return;
    }

    setIsLoading(true);
    try {
      // Check for name uniqueness only if the name has changed
      if (name.trim().toLowerCase() !== originalName.toLowerCase()) {
        const categoriesRef = collection(db, 'categories');
        const q = query(categoriesRef, 
          where('name', '==', name.trim()),
          where('userId', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          Alert.alert('Error', 'Another category with this name already exists.');
          setIsLoading(false);
          return;
        }
      }

      const categoryDocRef = doc(db, 'categories', categoryId);
      const updatedCategoryData: Partial<Category> & { updatedAt: any } = {
        name: name.trim(),
        icon: icon.trim() || '',
        updatedAt: serverTimestamp(),
      };

      await updateDoc(categoryDocRef, updatedCategoryData);
      Alert.alert('Success', 'Category updated successfully!');
      router.back(); // Go back to CategoriesScreen
    } catch (error) {
      console.error('Error updating category:', error);
      Alert.alert('Error', 'Failed to update category. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ color: theme.colors.text, marginTop: 10 }}>Loading category...</Text>
      </SafeAreaView>
    );
  }

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
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Edit Category</Text>
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

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]} 
            onPress={handleUpdateCategory}
            disabled={isLoading || isFetching}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Update Category</Text>
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
});

export default EditCategoryScreen;
