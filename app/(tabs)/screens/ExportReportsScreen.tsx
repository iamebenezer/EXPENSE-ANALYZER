import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { getExpensesForDateRange, calculateTotalExpenses, getDateRangePresets } from '../../../utils/expenseUtils';
import { generateCSV, generatePDFContent, getExportFileName, validateExportData, ExportData } from '../../../utils/exportUtils';
import { Share } from 'react-native';

interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

const ExportReportsScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { isLoading: categoriesLoading, fetchCategories } = useCategories();

  // State
  const [selectedPreset, setSelectedPreset] = useState<string>('last30Days');
  const [customStartDate, setCustomStartDate] = useState(new Date());
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [previewData, setPreviewData] = useState<ExportData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Get date range presets
  const datePresets = getDateRangePresets();

  // Fetch categories on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [fetchCategories])
  );

  // Get current date range based on selection
  const getCurrentDateRange = (): DateRange => {
    if (selectedPreset === 'custom') {
      return {
        startDate: customStartDate,
        endDate: customEndDate,
        label: 'Custom Range'
      };
    }

    const preset = datePresets[selectedPreset as keyof typeof datePresets];
    return {
      startDate: preset.startDate,
      endDate: preset.endDate,
      label: preset.label
    };
  };

  // Load preview data
  const loadPreviewData = async () => {
    if (!user) return;

    setIsLoadingPreview(true);
    try {
      const dateRange = getCurrentDateRange();

      const expenses = await getExpensesForDateRange(
        user.uid,
        dateRange.startDate,
        dateRange.endDate
      );

      const totalAmount = await calculateTotalExpenses(
        user.uid,
        dateRange.startDate,
        dateRange.endDate
      );

      const exportData: ExportData = {
        expenses,
        categories: [], // No categories for period-based budgets
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        totalAmount
      };

      setPreviewData(exportData);
    } catch (error) {
      console.error('Error loading preview data:', error);
      Alert.alert('Error', 'Failed to load preview data');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Load preview when parameters change
  useFocusEffect(
    useCallback(() => {
      if (!categoriesLoading) {
        loadPreviewData();
      }
    }, [selectedPreset, customStartDate, customEndDate, categoriesLoading])
  );

  // Handle export
  const handleExport = async () => {
    if (!user || !previewData) return;

    // Validate data
    const validation = validateExportData(previewData);
    if (!validation.isValid) {
      Alert.alert('Export Error', validation.errors.join('\n'));
      return;
    }

    setIsExporting(true);
    try {
      let content: string;
      let fileName: string;

      if (exportFormat === 'csv') {
        content = generateCSV(previewData);
        fileName = getExportFileName(previewData.startDate, previewData.endDate, 'csv');
      } else {
        content = generatePDFContent(previewData);
        fileName = getExportFileName(previewData.startDate, previewData.endDate, 'pdf');
      }

      // Use React Native's Share API to share the content
      const shareOptions = {
        title: 'Expense Report',
        message: `${fileName}\n\n${content}`,
        subject: `Expense Report - ${getCurrentDateRange().label}`,
      };

      const result = await Share.share(shareOptions);

      if (result.action === Share.sharedAction) {
        Alert.alert('Success', 'Report shared successfully!');
      } else if (result.action === Share.dismissedAction) {
        // User dismissed the share dialog
        console.log('Share dismissed');
      }

    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Export Error', 'Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Export Reports',
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date Range Selection */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Date Range</Text>

          <View style={styles.formElement}>
            <Text style={[styles.label, { color: theme.colors.textLight }]}>Select Period</Text>
            <View style={[styles.pickerContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
              <Picker
                selectedValue={selectedPreset}
                onValueChange={(value) => setSelectedPreset(value)}
                style={[styles.picker, { color: theme.colors.text }]}
                dropdownIconColor={theme.colors.textLight}
              >
                <Picker.Item label="Last 7 Days" value="last7Days" />
                <Picker.Item label="Last 30 Days" value="last30Days" />
                <Picker.Item label="Last 3 Months" value="last3Months" />
                <Picker.Item label="Last 6 Months" value="last6Months" />
                <Picker.Item label="Last Year" value="lastYear" />
                <Picker.Item label="This Month" value="thisMonth" />
                <Picker.Item label="This Year" value="thisYear" />
                <Picker.Item label="Custom Range" value="custom" />
              </Picker>
            </View>
          </View>

          {selectedPreset === 'custom' && (
            <View style={styles.customDateContainer}>
              <View style={styles.datePickerContainer}>
                <Text style={[styles.label, { color: theme.colors.textLight }]}>Start Date</Text>
                <Text style={[styles.dateButtonText, { color: theme.colors.text }]}>
                  {customStartDate.toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.datePickerContainer}>
                <Text style={[styles.label, { color: theme.colors.textLight }]}>End Date</Text>
                <Text style={[styles.dateButtonText, { color: theme.colors.text }]}>
                  {customEndDate.toLocaleDateString()}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Export Format */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Export Format</Text>

          <View style={styles.formatButtons}>
            <TouchableOpacity
              style={[
                styles.formatButton,
                {
                  backgroundColor: exportFormat === 'csv' ? theme.colors.primary : theme.colors.background,
                  borderColor: theme.colors.border
                }
              ]}
              onPress={() => setExportFormat('csv')}
            >
              <Ionicons
                name="document-text-outline"
                size={24}
                color={exportFormat === 'csv' ? 'white' : theme.colors.textLight}
              />
              <Text style={[
                styles.formatButtonText,
                { color: exportFormat === 'csv' ? 'white' : theme.colors.text }
              ]}>
                CSV
              </Text>
              <Text style={[
                styles.formatButtonSubtext,
                { color: exportFormat === 'csv' ? 'rgba(255,255,255,0.8)' : theme.colors.textLight }
              ]}>
                Spreadsheet format
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.formatButton,
                {
                  backgroundColor: exportFormat === 'pdf' ? theme.colors.primary : theme.colors.background,
                  borderColor: theme.colors.border
                }
              ]}
              onPress={() => setExportFormat('pdf')}
            >
              <Ionicons
                name="document-outline"
                size={24}
                color={exportFormat === 'pdf' ? 'white' : theme.colors.textLight}
              />
              <Text style={[
                styles.formatButtonText,
                { color: exportFormat === 'pdf' ? 'white' : theme.colors.text }
              ]}>
                PDF
              </Text>
              <Text style={[
                styles.formatButtonSubtext,
                { color: exportFormat === 'pdf' ? 'rgba(255,255,255,0.8)' : theme.colors.textLight }
              ]}>
                Formatted report
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Preview Section */}
        {isLoadingPreview ? (
          <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textLight }]}>Loading preview...</Text>
          </View>
        ) : previewData ? (
          <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Preview</Text>

            <View style={styles.previewStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: theme.colors.textLight }]}>Date Range</Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {getCurrentDateRange().label}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: theme.colors.textLight }]}>Total Expenses</Text>
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                  ${previewData.totalAmount.toFixed(2)}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: theme.colors.textLight }]}>Transactions</Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {previewData.expenses.length}
                </Text>
              </View>
            </View>

            {previewData.expenses.length === 0 && (
              <View style={styles.noDataContainer}>
                <Ionicons name="document-outline" size={48} color={theme.colors.textLight} />
                <Text style={[styles.noDataText, { color: theme.colors.textLight }]}>
                  No expenses found for the selected criteria
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Export Button */}
        <View style={styles.exportButtonContainer}>
          <TouchableOpacity
            style={[
              styles.exportButton,
              {
                backgroundColor: previewData && previewData.expenses.length > 0 ? theme.colors.primary : theme.colors.disabled,
                opacity: isExporting ? 0.7 : 1
              }
            ]}
            onPress={handleExport}
            disabled={!previewData || previewData.expenses.length === 0 || isExporting}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="download-outline" size={24} color="white" />
            )}
            <Text style={styles.exportButtonText}>
              {isExporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  formElement: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  customDateContainer: {
    marginTop: 16,
  },
  datePickerContainer: {
    marginBottom: 16,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  dateButtonText: {
    fontSize: 16,
  },
  formatButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  formatButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  formatButtonSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  previewStats: {
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noDataText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 16,
  },
  exportButtonContainer: {
    paddingVertical: 16,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  exportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ExportReportsScreen;
