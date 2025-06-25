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
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../firebaseConfig';
import { collection, addDoc, serverTimestamp, Timestamp, query, where, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Category, Expense, Budget } from '../../../models/types';
import { useCategories } from '../../../hooks/useCategories';

const AddExpenseScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  // Use the centralized categories hook
  const { categories, isLoading: isLoadingCategories, error: categoriesError, fetchCategories, retry } = useCategories();

  // Fetch categories when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchCategories().then(() => {
        // Set default category if none selected and categories are available
        if (!selectedCategoryId && categories.length > 0) {
          setSelectedCategoryId(categories[0].id);
        }
      });
    }, [fetchCategories, selectedCategoryId, categories.length])
  );

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS if needed, or set to false for modal behavior
    // setShowDatePicker(false); // Simpler: always close after interaction
    setDate(currentDate);
  };

  const handleAddExpense = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to add an expense.');
      return;
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert('Error', 'Please select a category.');
      return;
    }

    setIsLoading(true);
    const expenseAmount = parseFloat(amount);
    const expenseDate = Timestamp.fromDate(date); // Use the selected date
    const expenseCategoryId = selectedCategoryId; // Already validated

    try {
      // Check if there's an active budget for this category and date
      const budgetsRef1 = collection(db, 'budgets');
      const budgetQuery1 = query(
        budgetsRef1,
        where('userId', '==', user.uid),
        where('categoryId', '==', expenseCategoryId),
        where('startDate', '<=', expenseDate),
        where('endDate', '>=', expenseDate)
      );

      const budgetSnapshot1 = await getDocs(budgetQuery1);

      if (budgetSnapshot1.empty) {
        // No active budget found for this category
        Alert.alert(
          'No Budget Found',
          'You don\'t have an active budget for this category. Would you like to create one first?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setIsLoading(false)
            },
            {
              text: 'Create Budget',
              onPress: () => {
                setIsLoading(false);
                router.push('/(tabs)/screens/AddBudgetScreen');
              }
            }
          ]
        );
        return;
      }
      // 1. Add the new expense
      const newExpenseData = {
        userId: user.uid,
        amount: expenseAmount,
        categoryId: expenseCategoryId,
        date: expenseDate,
        description: description.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Firestore will resolve serverTimestamp() on the server.
      await addDoc(collection(db, 'expenses'), newExpenseData);

      // 2. Update relevant budget(s)
      const budgetsRef = collection(db, 'budgets');
      const budgetQuery = query(
        budgetsRef,
        where('userId', '==', user.uid),
        where('categoryId', '==', expenseCategoryId),
        where('startDate', '<=', expenseDate), // Expense date must be on or after budget start
        where('endDate', '>=', expenseDate)    // Expense date must be on or before budget end
      );

      const budgetSnapshot = await getDocs(budgetQuery);
      const batch = writeBatch(db);
      let budgetsFoundToUpdate = 0;

      budgetSnapshot.forEach((budgetDoc) => {
        budgetsFoundToUpdate++;
        const budgetData = budgetDoc.data() as Budget;
        const currentSpentAmount = budgetData.spentAmount || 0; // Default to 0 if undefined
        const newSpentAmount = currentSpentAmount + expenseAmount;

        const budgetDocRef = doc(db, 'budgets', budgetDoc.id);
        batch.update(budgetDocRef, {
          spentAmount: newSpentAmount,
          updatedAt: serverTimestamp(),
        });
      });

      if (budgetsFoundToUpdate > 0) {
        await batch.commit();
        console.log(`Successfully updated ${budgetsFoundToUpdate} budget(s).`);
      } else {
        console.log('No matching active budget found for this category and date to update.');
      }

      Alert.alert('Success', 'Expense added successfully!');
      router.back();
    } catch (error) {
      console.error('Error adding expense or updating budget:', error);
      // Consider more specific error handling or logging here
      Alert.alert('Error', 'Failed to add expense. Please check connection or try again.');
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
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Add New Expense</Text>
            <View style={{ width: 24 }} />{/* Spacer */}
          </View>

          <View style={styles.formElement}>
            <Text style={[styles.label, { color: theme.colors.textLight }]}>Amount</Text>
            <TextInput
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
              placeholder="0.00"
              placeholderTextColor={theme.colors.textLight}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          <View style={styles.formElement}>
            <Text style={[styles.label, { color: theme.colors.textLight }]}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
              placeholder="e.g., Coffee with client"
              placeholderTextColor={theme.colors.textLight}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          <View style={styles.formElement}>
            <Text style={[styles.label, { color: theme.colors.textLight }]}>Category</Text>
            {isLoadingCategories ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{alignSelf: 'flex-start'}} />
            ) : categoriesError ? (
              <View>
                <Text style={{color: theme.colors.danger, marginBottom: 10}}>{categoriesError}</Text>
                <TouchableOpacity onPress={retry} style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : categories.length === 0 ? (
              <Text style={{color: theme.colors.textLight}}>No categories available. Please add one first.</Text>
            ) : (
              <View style={[styles.pickerContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                <Picker
                  selectedValue={selectedCategoryId}
                  onValueChange={(itemValue) => setSelectedCategoryId(itemValue)}
                  style={[styles.picker, { color: theme.colors.text }]}
                  dropdownIconColor={theme.colors.textLight}
                >
                  {categories.map((category) => (
                    <Picker.Item key={category.id} label={category.name} value={category.id!} />
                  ))}
                </Picker>
              </View>
            )}
          </View>

          <View style={styles.formElement}>
            <Text style={[styles.label, { color: theme.colors.textLight }]}>Date</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.datePickerButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
              <Text style={{ color: theme.colors.text }}>{date.toLocaleDateString()}</Text>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.textLight} />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                testID="dateTimePicker"
                value={date}
                mode={'date'}
                display="default" // "spinner", "calendar", "clock"
                onChange={onDateChange}
                maximumDate={new Date()} // Prevent future dates for expenses
              />
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleAddExpense}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Save Expense</Text>
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
    paddingBottom: 50, // Ensure space for save button
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    padding: 5, // Make it easier to tap
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
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
  },
  picker: {
    height: Platform.OS === 'ios' ? undefined : 50, // iOS height is intrinsic
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 15 : 12,
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default AddExpenseScreen;
