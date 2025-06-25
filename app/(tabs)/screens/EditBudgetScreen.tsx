"use client";

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Theme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { db } from '../../../firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, Timestamp, or, deleteDoc } from 'firebase/firestore';
import { Category, Budget } from '../../../models/types';
import DateTimePicker from '@react-native-community/datetimepicker';

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
    color: theme.colors.text,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 20,
    justifyContent: 'center',
    borderColor: theme.colors.border,
  },
  picker: {
    height: 50,
    width: '100%',
    color: theme.colors.text,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
    borderColor: theme.colors.border,
  },
  inputContainer: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
  },
  dateText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  saveButton: {
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  deleteButton: {
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
    borderWidth: 1,
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // New styles for custom date range selection
  presetContainer: {
    marginBottom: 15,
  },
  presetButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  presetButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  presetButtonText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  presetButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  dateRangeSummary: {
    backgroundColor: theme.colors.card,
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateRangeDuration: {
    color: theme.colors.text,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});

const EditBudgetScreen = () => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { user } = useAuth();
  const router = useRouter();
  const { budgetId } = useLocalSearchParams<{ budgetId: string }>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [limitAmount, setLimitAmount] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<Budget['period']>('monthly');
  const [originalBudget, setOriginalBudget] = useState<Budget | null>(null);

  // State for custom date pickers
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() + 30)));
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // State for custom date range presets
  const [selectedDatePreset, setSelectedDatePreset] = useState<string>('30days');

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user || !budgetId) {
      setIsLoadingData(false);
      Alert.alert("Error", "User not logged in or Budget ID missing.");
      router.back();
      return;
    }

    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        // Fetch categories
        const categoriesCollectionRef = collection(db, 'categories');
        const catQuery = query(
          categoriesCollectionRef,
          or(where('isDefault', '==', true), where('userId', '==', user.uid))
        );
        const categoriesSnapshot = await getDocs(catQuery);
        const fetchedCategories: Category[] = [];
        categoriesSnapshot.forEach((doc) => {
          fetchedCategories.push({ id: doc.id, ...doc.data() } as Category);
        });
        setCategories(fetchedCategories);

        // Fetch the specific budget
        const budgetDocRef = doc(db, 'budgets', budgetId);
        const budgetDocSnap = await getDoc(budgetDocRef);

        if (budgetDocSnap.exists()) {
          const budgetData = { id: budgetDocSnap.id, ...budgetDocSnap.data() } as Budget;
          if (budgetData.userId !== user.uid) {
            Alert.alert("Access Denied", "You do not have permission to edit this budget.");
            router.back();
            return;
          }
          setOriginalBudget(budgetData);
          setSelectedCategoryId(budgetData.categoryId);
          setLimitAmount(budgetData.limitAmount.toString());
          setSelectedPeriod(budgetData.period);

          // Initialize custom dates based on fetched budget
          if (budgetData.period === 'custom' && budgetData.startDate && budgetData.endDate) {
            const startDate = budgetData.startDate.toDate();
            const endDate = budgetData.endDate.toDate();
            setCustomStartDate(startDate);
            setCustomEndDate(endDate);
            
            // Determine which preset matches the date range, if any
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 7) {
              setSelectedDatePreset('7days');
            } else if (diffDays === 14) {
              setSelectedDatePreset('14days');
            } else if (diffDays === 30 || diffDays === 31) {
              setSelectedDatePreset('30days');
            } else if (diffDays >= 89 && diffDays <= 92) { // ~3 months
              setSelectedDatePreset('3months');
            } else if (diffDays >= 180 && diffDays <= 184) { // ~6 months
              setSelectedDatePreset('6months');
            } else {
              setSelectedDatePreset('custom');
            }
          } else {
            // Provide default if not custom or dates are somehow missing
            const today = new Date();
            setCustomStartDate(today);
            setCustomEndDate(new Date(new Date().setDate(today.getDate() + 30)));
            setSelectedDatePreset('30days');
          }
        } else {
          Alert.alert("Error", "Budget not found.");
          router.back();
        }
      } catch (error) {
        console.error("Error fetching data for edit: ", error);
        Alert.alert("Error", "Could not load budget data for editing.");
        router.back();
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [user, budgetId, router]);

  // Function to apply date presets
  const applyDatePreset = (preset: string) => {
    setSelectedDatePreset(preset);
    const today = new Date();
    let start = new Date();
    let end = new Date();
    
    switch (preset) {
      case '7days':
        // Next 7 days
        end = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case '14days':
        // Next 14 days
        end = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        // Next 30 days
        end = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        // Next 3 months
        end = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
        break;
      case '6months':
        // Next 6 months
        end = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());
        break;
      case 'custom':
        // Keep current custom dates
        return;
      default:
        // Default to 30 days
        end = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
    
    setCustomStartDate(start);
    setCustomEndDate(end);
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || customStartDate;
    setShowStartDatePicker(Platform.OS === 'ios');
    setCustomStartDate(currentDate);
    // Set to custom preset when user manually selects a date
    setSelectedDatePreset('custom');
    
    if (currentDate > customEndDate) { 
      setCustomEndDate(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)); 
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || customEndDate;
    setShowEndDatePicker(Platform.OS === 'ios');
    
    if (currentDate < customStartDate) {
      Alert.alert("Invalid Date", "End date cannot be before the start date.");
    } else {
      setCustomEndDate(currentDate);
      // Set to custom preset when user manually selects a date
      setSelectedDatePreset('custom');
    }
  };
  
  // Calculate the duration between start and end dates in days
  const calculateDuration = () => {
    const diffTime = Math.abs(customEndDate.getTime() - customStartDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleUpdateBudget = async () => {
    if (!user || !budgetId || !originalBudget) {
      Alert.alert("Error", "Missing required data to update budget.");
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert("Validation Error", "Please select a category.");
      return;
    }
    const amount = parseFloat(limitAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Validation Error", "Please enter a valid budget amount greater than 0.");
      return;
    }

    setIsSaving(true);
    try {
      const budgetDocRef = doc(db, 'budgets', budgetId);
      
      let finalStartDate: Date;
      let finalEndDate: Date;
      const now = new Date();

      if (selectedPeriod === 'custom') {
        finalStartDate = customStartDate;
        finalEndDate = customEndDate;
      } else {
        switch (selectedPeriod) {
          case 'weekly':
            finalStartDate = new Date(now);
            finalStartDate.setDate(now.getDate() - now.getDay()); // Sunday
            finalEndDate = new Date(finalStartDate);
            finalEndDate.setDate(finalStartDate.getDate() + 6); // Saturday
            break;
          case 'yearly':
            finalStartDate = new Date(now.getFullYear(), 0, 1); // Jan 1st
            finalEndDate = new Date(now.getFullYear(), 11, 31); // Dec 31st
            break;
          case 'monthly':
          default:
            finalStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
            finalEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        }
      }
      
      // Check for overlapping budgets (excluding the current budget being edited)
      const budgetsRef = collection(db, 'budgets');
      const q = query(
        budgetsRef,
        where('userId', '==', user.uid),
        where('categoryId', '==', selectedCategoryId)
      );

      const querySnapshot = await getDocs(q);
      let hasOverlap = false;
      let overlappingBudgetId = '';
      let overlappingBudgetPeriod = '';

      querySnapshot.forEach((doc) => {
        // Skip the current budget being edited
        if (doc.id === budgetId) return;
        
        const existingBudget = doc.data();
        const existingStart = existingBudget.startDate.toDate();
        const existingEnd = existingBudget.endDate.toDate();

        // Check if date ranges overlap
        if (finalStartDate <= existingEnd && finalEndDate >= existingStart) {
          hasOverlap = true;
          overlappingBudgetId = doc.id;
          overlappingBudgetPeriod = existingBudget.period;
        }
      });

      if (hasOverlap) {
        Alert.alert(
          'Budget Overlap',
          `This update would overlap with another ${overlappingBudgetPeriod} budget for the same category. Please adjust the dates or delete the other budget first.`,
          [{ text: 'OK' }]
        );
        setIsSaving(false);
        return;
      }

      const updatedBudgetData: Partial<Budget> = {
        categoryId: selectedCategoryId,
        limitAmount: amount,
        period: selectedPeriod,
        startDate: Timestamp.fromDate(finalStartDate),
        endDate: Timestamp.fromDate(finalEndDate),
        updatedAt: serverTimestamp() as Timestamp,
      };

      await updateDoc(budgetDocRef, updatedBudgetData);
      Alert.alert("Success", "Budget updated successfully.");
      router.back(); // Or navigate to budget list screen
    } catch (error) {
      console.error("Error updating budget: ", error);
      Alert.alert("Error", "Could not update budget. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBudget = async () => {
    if (!user || !budgetId) {
      Alert.alert("Error", "Cannot delete budget: Missing ID or user not logged in.");
      return;
    }

    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this budget? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsSaving(true); // Use isSaving to indicate loading state for delete as well
            try {
              const budgetDocRef = doc(db, 'budgets', budgetId);
              await deleteDoc(budgetDocRef); // Import deleteDoc
              Alert.alert("Success", "Budget deleted successfully!");
              router.replace({ pathname: '/(tabs)/screens/BudgetScreen' });
            } catch (error) {
              console.error("Error deleting budget: ", error);
              Alert.alert("Error", "Could not delete budget. Please try again.");
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
  };

  if (isLoadingData) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ color: theme.colors.text, marginTop: 10 }}>Loading budget details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen 
        options={{
          title: 'Edit Budget',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: theme.colors.background,
          },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
        }}
      />
      <View style={styles.content}>
        <Text style={styles.label}>Category</Text>
        {categories.length > 0 ? (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedCategoryId}
              onValueChange={(itemValue) => setSelectedCategoryId(itemValue)}
              style={styles.picker}
              dropdownIconColor={theme.colors.text}
              enabled={!isSaving}
            >
              {categories.map((category) => (
                <Picker.Item key={category.id} label={category.name} value={category.id!} />
              ))}
            </Picker>
          </View>
        ) : (
          <Text style={{ color: theme.colors.textLight, marginVertical: 10 }}>Loading categories or none available.</Text>
        )}

        <Text style={styles.label}>Budget Period</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedPeriod}
            onValueChange={(itemValue) => setSelectedPeriod(itemValue)}
            style={styles.picker}
            dropdownIconColor={theme.colors.text}
            enabled={!isSaving}
          >
            <Picker.Item label="Monthly" value="monthly" />
            <Picker.Item label="Weekly" value="weekly" />
            <Picker.Item label="Yearly" value="yearly" />
            <Picker.Item label="Custom" value="custom" />
          </Picker>
        </View>

        {selectedPeriod === 'custom' && (
          <>
            <Text style={styles.label}>Date Range Presets</Text>
            <View style={styles.presetContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity 
                  style={[styles.presetButton, selectedDatePreset === '7days' && styles.presetButtonActive]}
                  onPress={() => applyDatePreset('7days')}
                >
                  <Text style={[styles.presetButtonText, selectedDatePreset === '7days' && styles.presetButtonTextActive]}>7 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.presetButton, selectedDatePreset === '14days' && styles.presetButtonActive]}
                  onPress={() => applyDatePreset('14days')}
                >
                  <Text style={[styles.presetButtonText, selectedDatePreset === '14days' && styles.presetButtonTextActive]}>14 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.presetButton, selectedDatePreset === '30days' && styles.presetButtonActive]}
                  onPress={() => applyDatePreset('30days')}
                >
                  <Text style={[styles.presetButtonText, selectedDatePreset === '30days' && styles.presetButtonTextActive]}>30 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.presetButton, selectedDatePreset === '3months' && styles.presetButtonActive]}
                  onPress={() => applyDatePreset('3months')}
                >
                  <Text style={[styles.presetButtonText, selectedDatePreset === '3months' && styles.presetButtonTextActive]}>3 Months</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.presetButton, selectedDatePreset === '6months' && styles.presetButtonActive]}
                  onPress={() => applyDatePreset('6months')}
                >
                  <Text style={[styles.presetButtonText, selectedDatePreset === '6months' && styles.presetButtonTextActive]}>6 Months</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
            
            <View style={styles.dateRangeSummary}>
              <Text style={styles.dateRangeDuration}>Duration: {calculateDuration()} days</Text>
            </View>
            
            <Text style={styles.label}>Start Date</Text>
            <TouchableOpacity onPress={() => setShowStartDatePicker(true)} style={styles.inputContainer}>
              <Text style={styles.dateText}>{customStartDate.toLocaleDateString()}</Text>
            </TouchableOpacity>
            {showStartDatePicker && (
              <DateTimePicker
                testID="startDatePicker"
                value={customStartDate}
                mode="date"
                display="default"
                onChange={onStartDateChange}
              />
            )}

            <Text style={styles.label}>End Date</Text>
            <TouchableOpacity onPress={() => setShowEndDatePicker(true)} style={styles.inputContainer}>
              <Text style={styles.dateText}>{customEndDate.toLocaleDateString()}</Text>
            </TouchableOpacity>
            {showEndDatePicker && (
              <DateTimePicker
                testID="endDatePicker"
                value={customEndDate}
                mode="date"
                display="default"
                onChange={onEndDateChange}
                minimumDate={customStartDate}
              />
            )}
          </>
        )}

        <Text style={styles.label}>Budget Amount (₦)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter amount"
          placeholderTextColor={theme.colors.textLight}
          keyboardType="numeric"
          value={limitAmount}
          onChangeText={setLimitAmount}
          editable={!isSaving}
        />

        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: isSaving ? theme.colors.secondary : theme.colors.primary },
          ]}
          onPress={handleUpdateBudget}
          disabled={isSaving || isLoadingData}
        >
          {isSaving && !isLoadingData ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Update Budget</Text>
          )}
        </TouchableOpacity>

        {!isLoadingData && originalBudget && (
          <TouchableOpacity
            style={[
              styles.deleteButton,
            ]}
            onPress={handleDeleteBudget}
            disabled={isSaving}
          >
            <Text style={styles.deleteButtonText}>Delete Budget</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

export default EditBudgetScreen;
