"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../firebaseConfig';
import { collection, query, where, getDocs, orderBy, doc, deleteDoc, DocumentData } from 'firebase/firestore';
import { Expense } from '../../../models/types'; // Import the Expense type

const ExpensesScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = async () => {
    if (!user) {
      setExpenses([]); // Clear expenses if user logs out
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const expensesCollectionRef = collection(db, 'expenses');
      const q = query(
        expensesCollectionRef,
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const fetchedExpenses: Expense[] = [];
      querySnapshot.forEach((doc) => {
        fetchedExpenses.push({ id: doc.id, ...doc.data() } as Expense);
      });
      setExpenses(fetchedExpenses);
    } catch (err: any) {
      console.error('Error fetching expenses:', err);
      setError('Failed to fetch expenses. Please try again.');
      Alert.alert('Error', 'Failed to fetch expenses.');
    } finally {
      setIsLoading(false);
    }
  };

  // useFocusEffect to refetch expenses when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchExpenses();
    }, [user, db]) // Re-run if user or db instance changes (db unlikely but good practice)
  );

  const handleDeleteExpense = async (expenseId: string) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
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
              // First, get the expense details to update associated budgets
              const expenseDocRef = doc(db, 'expenses', expenseId);
              const expenseSnap = await getDoc(expenseDocRef);

              if (!expenseSnap.exists()) {
                Alert.alert('Error', 'Expense not found.');
                return;
              }

              const expenseData = expenseSnap.data() as Expense;

              // Start a batch write for consistency
              const batch = writeBatch(db);

              // 1. Delete the expense document
              batch.delete(expenseDocRef);

              // 2. Update any associated budgets
              const budgetsRef = collection(db, 'budgets');
              const budgetQuery = query(
                budgetsRef,
                where('userId', '==', user.uid),
                where('categoryId', '==', expenseData.categoryId),
                where('startDate', '<=', expenseData.date),
                where('endDate', '>=', expenseData.date)
              );

              const budgetSnapshot = await getDocs(budgetQuery);
              let budgetsUpdated = 0;

              budgetSnapshot.forEach((budgetDoc) => {
                budgetsUpdated++;
                const budgetData = budgetDoc.data() as Budget;
                const currentSpentAmount = budgetData.spentAmount || 0;
                const newSpentAmount = Math.max(0, currentSpentAmount - expenseData.amount);

                batch.update(doc(db, 'budgets', budgetDoc.id), {
                  spentAmount: newSpentAmount,
                  updatedAt: serverTimestamp(),
                });
              });

              // Commit all changes atomically
              await batch.commit();

              // Update the UI
              setExpenses((prevExpenses) => prevExpenses.filter((exp) => exp.id !== expenseId));

              if (budgetsUpdated > 0) {
                Alert.alert('Success', `Expense deleted and ${budgetsUpdated} budget(s) updated.`);
              } else {
                Alert.alert('Success', 'Expense deleted successfully. No budgets needed updating.');
              }
            } catch (err) {
              console.error('Error deleting expense:', err);
              Alert.alert('Error', 'Failed to delete expense.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderExpenseItem = ({ item }: { item: Expense }) => (
    <TouchableOpacity
      style={[styles.expenseItem, { backgroundColor: theme.colors.card }]}
      onPress={() => router.push({ pathname: '/(tabs)/screens/EditExpenseScreen', params: { expenseId: item.id } })}
    >
      <View style={styles.expenseDetails}>
        <Text style={[styles.expenseDescription, { color: theme.colors.text }]}>
          {item.description || 'No description'}
        </Text>
        <Text style={[styles.expenseDate, { color: theme.colors.textLight }]}>
          {item.date && item.date.seconds ? new Date(item.date.seconds * 1000).toLocaleDateString() : 'Invalid Date'}
        </Text>
      </View>
      <View style={styles.amountAndDeleteContainer}>
        <Text style={[styles.expenseAmount, { color: theme.colors.primary }]}>
          ₦{item.amount.toFixed(2)}
        </Text>
        <TouchableOpacity onPress={() => handleDeleteExpense(item.id!)} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={22} color={theme.colors.danger} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
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
        <TouchableOpacity onPress={fetchExpenses} style={[styles.button, { backgroundColor: theme.colors.primary, marginTop: 20 }]}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen
        options={{
          title: 'My Expenses',
          headerStyle: {
            backgroundColor: theme.colors.background,
          },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => router.push('/(tabs)/screens/AddExpenseScreen')}
            >
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          ),
        }}
      />

      {expenses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.textLight }]}>
            No expenses yet. Tap the '+' button to add your first expense!
          </Text>
        </View>
      ) : (
        <FlatList
          data={expenses}
          renderItem={renderExpenseItem}
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
    borderRadius: 20, // Makes it circular
  },
  listContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  expenseDetails: {
    flex: 1,
    marginRight: 10, // Add some space before amount/delete icons
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: '500',
  },
  expenseDate: {
    fontSize: 12,
    marginTop: 4,
  },
  amountAndDeleteContainer: { // New container for amount and delete icon
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 15, // Space between amount and delete icon
  },
  deleteButton: {
    padding: 5, // Easier to tap
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

export default ExpensesScreen;
