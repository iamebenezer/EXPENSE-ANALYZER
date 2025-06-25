"use client";

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../firebaseConfig';
import { doc, deleteDoc } from 'firebase/firestore';
import { Category } from '../../../models/types';
import { useCategories } from '../../../hooks/useCategories';

const CategoriesScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  // Use the centralized categories hook
  const { categories, isLoading, error, fetchCategories, retry } = useCategories();

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [fetchCategories])
  );

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete the category "${categoryName}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) {
              Alert.alert('Error', 'You must be logged in.');
              return;
            }
            try {
              // First, ensure this is not a default category (double check)
              const categoryDocRef = doc(db, 'categories', categoryId);
              // We could fetch the doc again to be absolutely sure it's not default and belongs to user,
              // but for now, we rely on the UI only showing delete for user-created ones.
              // More robust check: fetch doc, verify item.userId === user.uid && !item.isDefault

              await deleteDoc(categoryDocRef);
              // Refresh categories after deletion
              fetchCategories();
              Alert.alert('Success', `Category "${categoryName}" deleted successfully.`);
            } catch (err) {
              console.error('Error deleting category:', err);
              Alert.alert('Error', 'Failed to delete category.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <View style={[styles.categoryItem, { backgroundColor: theme.colors.card }]}>
      <Ionicons name={item.icon || 'list-outline' as any} size={24} color={theme.colors.primary} style={styles.categoryIcon} />
      <Text style={[styles.categoryName, { color: theme.colors.text }]}>{item.name}</Text>
      {/* Add Edit/Delete buttons here later for user-created categories */}
      {!item.isDefault && (
        <View style={styles.actionsContainer}>
            <TouchableOpacity 
                onPress={() => router.push({ pathname: '/(tabs)/screens/EditCategoryScreen', params: { categoryId: item.id } })}
                style={styles.actionButton}
            >
                <Ionicons name="pencil-outline" size={20} color={theme.colors.textLight} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteCategory(item.id!, item.name)} style={styles.actionButton}>
                <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
            </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.colors.text }}>{error}</Text>
        <TouchableOpacity onPress={retry} style={[styles.button, { backgroundColor: theme.colors.primary, marginTop: 20 }]}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Manage Categories</Text>
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]} 
          onPress={() => router.push('/(tabs)/screens/AddCategoryScreen')}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {categories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.textLight }]}>
            No categories found. Tap '+' to add a new category.
          </Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id!}
          contentContainerStyle={styles.listContentContainer}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    padding: 10,
    borderRadius: 20, 
  },
  backButton: {
    padding: 5,
  },
  listContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  categoryIcon: {
    marginRight: 15,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1, // Allow name to take available space
  },
  actionsContainer: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 10,
    padding: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CategoriesScreen;
