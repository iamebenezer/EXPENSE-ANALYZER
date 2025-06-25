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
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../firebaseConfig';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp, collection, query, where, getDocs, orderBy, or } from 'firebase/firestore';
import { Category, Expense } from '../../../models/types';

const EditExpenseScreen = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { expenseId } = useLocalSearchParams<{ expenseId?: string }>();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingExpense, setIsFetchingExpense] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  useEffect(() => {
    const fetchCategoriesForPicker = async () => {
      if (!user) {
        setCategories([]);
        setIsLoadingCategories(false);
        return;
      }
      setIsLoadingCategories(true);
      try {
        const categoriesCollectionRef = collection(db, 'categories');
        const q = query(
          categoriesCollectionRef,
          or(where('isDefault', '==', true), where('userId', '==', user.uid)),
          orderBy('name', 'asc')
        );
        const querySnapshot = await getDocs(q);
        const fetchedCategories: Category[] = [];
        querySnapshot.forEach((doc) => {
          fetchedCategories.push({ id: doc.id, ...doc.data() } as Category);
        });
        setCategories(fetchedCategories);
      } catch (error) {
        console.error('Error fetching categories for picker:', error);
        Alert.alert('Error', 'Could not load categories.');
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategoriesForPicker();
  }, [user]);

  useEffect(() => {
    if (!expenseId || !user) {
      Alert.alert('Error', 'Expense ID is missing or user not logged in.');
      router.back();
      return;
    }

    const fetchExpenseDetails = async () => {
      setIsFetchingExpense(true);
      try {
        const expenseDocRef = doc(db, 'expenses', expenseId);
        const expenseSnap = await getDoc(expenseDocRef);

        if (expenseSnap.exists()) {
          const expenseData = expenseSnap.data() as Expense;
          if (expenseData.userId !== user.uid) {
            Alert.alert('Error', 'You do not have permission to edit this expense.');
            router.back();
            return;
          }

          setAmount(expenseData.amount.toString());
          setDescription(expenseData.description || '');
          if (expenseData.date instanceof Timestamp) {
            setDate(expenseData.date.toDate());
          } else if (typeof expenseData.date === 'string') {
            setDate(new Date(expenseData.date));
          } else {
            setDate(new Date());
          }
          setSelectedCategoryId(expenseData.categoryId);
        } else {
          Alert.alert('Error', 'Expense not found.');
          router.back();
        }
      } catch (error) {
        console.error('Error fetching expense:', error);
        Alert.alert('Error', 'Failed to fetch expense details.');
        router.back();
      } finally {
        setIsFetchingExpense(false);
      }
    };

    fetchExpenseDetails();
  }, [expenseId, user, router]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS if needed, or set to false for modal behavior
    // setShowDatePicker(false); // Simpler: always close after interaction
    setDate(currentDate);
  };

  const handleUpdateExpense = async () => {
    if (!user || !expenseId) {
      Alert.alert('Error', 'User not logged in or Expense ID missing.');
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
    try {
      // First, get the original expense to calculate budget adjustments
      const expenseDocRef = doc(db, 'expenses', expenseId);
      const expenseSnap = await getDoc(expenseDocRef);
      
      if (!expenseSnap.exists()) {
        Alert.alert('Error', 'Expense not found.');
        setIsLoading(false);
        return;
      }
      
      const originalExpense = expenseSnap.data() as Expense;
      const newAmount = parseFloat(amount);
      const newDate = Timestamp.fromDate(date);
      const newCategoryId = selectedCategoryId;
      
      // Create updated expense data
      const updatedExpenseData: Partial<Expense> = {
        amount: newAmount,
        categoryId: newCategoryId,
        date: newDate,
        description: description.trim(),
        updatedAt: serverTimestamp() as any,
      };

      // 1. Update the expense document
      await updateDoc(expenseDocRef, updatedExpenseData);
      
      // 2. Handle budget updates
      // If category or date changed, we need to update both old and new budgets
      const categoryChanged = originalExpense.categoryId !== newCategoryId;
      const dateChanged = !(originalExpense.date.seconds === newDate.seconds && 
                           originalExpense.date.nanoseconds === newDate.nanoseconds);
      const amountChanged = originalExpense.amount !== newAmount;
      
      // Only update budgets if something relevant changed
      if (amountChanged || categoryChanged || dateChanged) {
        const batch = writeBatch(db);
        
        // If category or date changed, subtract the original amount from the old budget
        if (categoryChanged || dateChanged) {
          const oldBudgetsQuery = query(
            collection(db, 'budgets'),
            where('userId', '==', user.uid),
            where('categoryId', '==', originalExpense.categoryId),
            where('startDate', '<=', originalExpense.date),
            where('endDate', '>=', originalExpense.date)
          );
          
          const oldBudgetSnapshot = await getDocs(oldBudgetsQuery);
          
          oldBudgetSnapshot.forEach((budgetDoc) => {
            const budgetData = budgetDoc.data() as Budget;
            const currentSpentAmount = budgetData.spentAmount || 0;
            const newSpentAmount = Math.max(0, currentSpentAmount - originalExpense.amount);
            
            batch.update(doc(db, 'budgets', budgetDoc.id), {
              spentAmount: newSpentAmount,
              updatedAt: serverTimestamp(),
            });
          });
        }
        
        // Add the new amount to the new budget (or the same budget if only amount changed)
        const newBudgetsQuery = query(
          collection(db, 'budgets'),
          where('userId', '==', user.uid),
          where('categoryId', '==', newCategoryId),
          where('startDate', '<=', newDate),
          where('endDate', '>=', newDate)
        );
        
        const newBudgetSnapshot = await getDocs(newBudgetsQuery);
        
        newBudgetSnapshot.forEach((budgetDoc) => {
          const budgetData = budgetDoc.data() as Budget;
          const currentSpentAmount = budgetData.spentAmount || 0;
          
          // If only the amount changed and it's the same budget, adjust by the difference
          let newSpentAmount;
          if (!categoryChanged && !dateChanged) {
            // Just add the difference between new and old amounts
            newSpentAmount = currentSpentAmount + (newAmount - originalExpense.amount);
          } else {
            // Add the full new amount
            newSpentAmount = currentSpentAmount + newAmount;
          }
          
          batch.update(doc(db, 'budgets', budgetDoc.id), {
            spentAmount: newSpentAmount,
            updatedAt: serverTimestamp(),
          });
        });
        
        // Commit all budget updates
        await batch.commit();
      }
      
      Alert.alert('Success', 'Expense updated successfully!');
      router.back();
    } catch (error) {
      console.error('Error updating expense:', error);
      Alert.alert('Error', 'Failed to update expense. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetchingExpense || isLoadingCategories) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ color: theme.colors.text, marginTop: 10 }}>
          {isFetchingExpense ? 'Loading expense...' : 'Loading categories...'}
        </Text>
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
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Edit Expense</Text>
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
            {categories.length === 0 && !isLoadingCategories ? (
                <Text style={{color: theme.colors.textLight}}>No categories available. Please add one first.</Text>
            ) : (
                <View style={[styles.pickerContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                    <Picker
                        selectedValue={selectedCategoryId}
                        onValueChange={(itemValue) => setSelectedCategoryId(itemValue)}
                        style={[styles.picker, { color: theme.colors.text }]}
                        dropdownIconColor={theme.colors.textLight}
                        enabled={!isLoadingCategories && categories.length > 0}
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
                display="default"
                onChange={onDateChange}
                maximumDate={new Date()} // Prevent future dates for expenses
              />
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleUpdateExpense}
            disabled={isLoading || isFetchingExpense}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Update Expense</Text>
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
  pickerContainer: { 
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
  },
  picker: { 
    height: Platform.OS === 'ios' ? undefined : 50,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 15 : 10,
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

export default EditExpenseScreen;
