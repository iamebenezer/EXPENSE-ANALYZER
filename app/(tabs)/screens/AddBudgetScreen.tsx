"use client";

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Platform, ScrollView } from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Theme } from '../../../context/ThemeContext'; 
import { useAuth } from '../../../context/AuthContext';
import { Stack, useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { db } from '../../../firebaseConfig';
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, or, doc, updateDoc, orderBy } from 'firebase/firestore';
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

const AddBudgetScreen = () => {
  const { theme } = useTheme(); 
  const styles = getStyles(theme); 
  const { user } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [limitAmount, setLimitAmount] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<Budget['period']>('monthly');
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // State for custom date pickers
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() + 30))); 
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // State for custom date range presets
  const [selectedDatePreset, setSelectedDatePreset] = useState<string>('30days');

  useEffect(() => {
    if (!user) return;

    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const categoriesCollectionRef = collection(db, 'categories');
        const q = query(
          categoriesCollectionRef,
          or(
            where('isDefault', '==', true),
            where('userId', '==', user.uid)
          ),
          orderBy('name', 'asc')
        );

        const querySnapshot = await getDocs(q);
        const fetchedCategories: Category[] = [];
        querySnapshot.forEach((doc) => {
          fetchedCategories.push({ id: doc.id, ...doc.data() } as Category);
        });

        if (fetchedCategories.length > 0) {
          setCategories(fetchedCategories);
          setSelectedCategoryId(fetchedCategories[0].id);
        } else {
          Alert.alert(
            "No Categories Found",
            "Please add at least one category before creating a budget.",
            [
              {
                text: "Add Category",
                onPress: () => router.push('/(tabs)/screens/AddCategoryScreen')
              },
              { text: "Cancel", style: "cancel" }
            ]
          );
        }
      } catch (error) {
        console.error("Error fetching categories: ", error);
        Alert.alert("Error", "Could not load categories.");
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, [user, router]);

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

  const handleSaveBudget = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to add a budget.");
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
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (selectedPeriod === 'custom') {
        startDate = customStartDate;
        endDate = customEndDate;
        // Ensure time part is reset for consistency if needed, or handle as full timestamps
        // startDate.setHours(0, 0, 0, 0);
        // endDate.setHours(23, 59, 59, 999);
      } else {
        switch (selectedPeriod) {
          case 'weekly':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - now.getDay()); 
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6); 
            break;
          case 'yearly':
            startDate = new Date(now.getFullYear(), 0, 1); 
            endDate = new Date(now.getFullYear(), 11, 31); 
            break;
          case 'monthly':
          default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        }
      }

      // Check if a budget already exists for this category and time period
      const budgetsRef = collection(db, 'budgets');
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);
      
      console.log(`Checking for existing budgets: Category=${selectedCategoryId}, Period=${selectedPeriod}`);
      console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      // Query for budgets with the same category and overlapping date range
      const q = query(
        budgetsRef,
        where('userId', '==', user.uid),
        where('categoryId', '==', selectedCategoryId)
      );
      
      const querySnapshot = await getDocs(q);
      let overlappingBudgets: { id: string; data: any }[] = [];
      
      querySnapshot.forEach((doc) => {
        const existingBudget = doc.data();
        const existingStart = existingBudget.startDate.toDate();
        const existingEnd = existingBudget.endDate.toDate();

        // Check if date ranges overlap
        if (
          (startDate <= existingEnd && endDate >= existingStart)
        ) {
          overlappingBudgets.push({ id: doc.id, data: existingBudget });
        }
      });
      
      console.log(`Found ${overlappingBudgets.length} overlapping budgets for this category`);
      
      if (overlappingBudgets.length > 0) {
         // If there's exactly one overlapping budget with the same period type, offer to update it
         if (overlappingBudgets.length === 1 && overlappingBudgets[0].data.period === selectedPeriod) {
           const existingBudget = overlappingBudgets[0];
           
           Alert.alert(
             'Budget Already Exists',
             `You already have a ${selectedPeriod} budget for this category during this time period. Would you like to update it instead?`,
             [
               { 
                 text: 'Cancel', 
                 style: 'cancel',
                 onPress: () => setIsSaving(false)
               },
               {
                 text: 'Update Existing',
                 onPress: async () => {
                   try {
                     // Update the existing budget with the new amount
                     const budgetDocRef = doc(db, 'budgets', existingBudget.id);
                     await updateDoc(budgetDocRef, {
                       limitAmount: parseFloat(amount),
                       updatedAt: serverTimestamp()
                     });
                     
                     Alert.alert('Success', 'Budget updated successfully!');
                     router.back();
                   } catch (error) {
                     console.error('Error updating budget:', error);
                     Alert.alert('Error', 'Failed to update budget. Please try again.');
                   } finally {
                     setIsSaving(false);
                   }
                 }
               }
             ]
           );
           return;
         } else if (overlappingBudgets.length > 1) {
           // Multiple overlapping budgets - more complex situation
           Alert.alert(
             'Multiple Overlapping Budgets',
             'You have multiple budgets for this category that overlap with the selected date range. Please edit or delete existing budgets first.',
             [{ text: 'OK' }]
           );
           setIsSaving(false);
           return;
         } else {
           // One overlapping budget but with different period type
           Alert.alert(
             'Budget Period Conflict',
             `You already have a ${overlappingBudgets[0].data.period} budget for this category that overlaps with your selected ${selectedPeriod} period. Please edit or delete the existing budget first.`,
             [{ text: 'OK' }]
           );
           setIsSaving(false);
           return;
         }
       }

      const newBudget: Omit<Budget, 'id'> = {
        userId: user.uid,
        categoryId: selectedCategoryId,
        limitAmount: amount,
        spentAmount: 0,
        period: selectedPeriod,
        startDate: startTimestamp,
        endDate: endTimestamp,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
      };

      await addDoc(collection(db, 'budgets'), newBudget);
      Alert.alert("Success", "Budget added successfully!");
      router.back(); 
    } catch (error) {
      console.error("Error saving budget: ", error);
      Alert.alert("Error", "Could not save budget. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingCategories) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ color: theme.colors.text, marginTop: 10 }}>Loading categories...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Add Budget',
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
            >
              {categories.map((category) => (
                <Picker.Item key={category.id} label={category.name} value={category.id!} />
              ))}
            </Picker>
          </View>
        ) : (
          <Text style={{ color: theme.colors.textLight, marginVertical: 10 }}>No categories available. Please add categories first.</Text>
        )}

        <Text style={styles.label}>Budget Period</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedPeriod}
            onValueChange={(itemValue) => setSelectedPeriod(itemValue)}
            style={styles.picker}
            dropdownIconColor={theme.colors.text}
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
                minimumDate={new Date()} 
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
        />

        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: isSaving ? theme.colors.secondary : theme.colors.primary },
          ]}
          onPress={handleSaveBudget}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Budget</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default AddBudgetScreen;
