"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useTheme, Theme } from "../../../context/ThemeContext";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebaseConfig";
import { collection, query, where, getDocs, Timestamp, or } from 'firebase/firestore';
import { checkBudgetStatus } from '../../../utils/notificationUtils';
import { checkAndUpdateExpiredBudgets, getBudgetHistory, getExpensesForBudget } from '../../../utils/budgetUtils';
import { Budget, Category, BudgetHistory, Expense, BudgetWithCategory } from "../../../models/types";

interface BudgetDisplayItem extends Budget {
  categoryName: string;
  categoryIcon?: string;
  status?: 'normal' | 'warning' | 'high-warning' | 'danger' | 'exceeded';
  statusMessage?: string;
  history?: BudgetHistory[];
  expenses?: Expense[];
}

type PeriodFilter = 'all' | 'weekly' | 'monthly' | 'yearly' | 'custom';
type StatusFilter = 'all' | 'active' | 'completed';

const BudgetScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [budgets, setBudgets] = useState<BudgetDisplayItem[]>([]);
  const [filteredBudgets, setFilteredBudgets] = useState<BudgetDisplayItem[]>([]);
  const [categoriesMap, setCategoriesMap] = useState<Map<string, Category>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingExpired, setIsCheckingExpired] = useState(false);
  
  // Filtering states
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  
  // Modal states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<BudgetDisplayItem | null>(null);
  const [budgetHistory, setBudgetHistory] = useState<BudgetHistory[]>([]);
  const [budgetExpenses, setBudgetExpenses] = useState<Expense[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setBudgets([]);
      setFilteredBudgets([]);
      setCategoriesMap(new Map());
      return;
    }

    setIsLoading(true);
    try {
      // First check for expired budgets and update them
      setIsCheckingExpired(true);
      await checkAndUpdateExpiredBudgets(user.uid);
      setIsCheckingExpired(false);
      
      // Fetch categories
      const categoriesCollectionRef = collection(db, 'categories');
      const catQuery = query(
        categoriesCollectionRef,
        or(where('isDefault', '==', true), where('userId', '==', user.uid))
      );
      const categoriesSnapshot = await getDocs(catQuery);
      const fetchedCategoriesMap = new Map<string, Category>();
      categoriesSnapshot.forEach(doc => {
        fetchedCategoriesMap.set(doc.id, { id: doc.id, ...doc.data() } as Category);
      });
      setCategoriesMap(fetchedCategoriesMap);

      // Fetch budgets
      const budgetsCollectionRef = collection(db, 'budgets');
      const budgetQuery = query(budgetsCollectionRef, where('userId', '==', user.uid));
      const budgetsSnapshot = await getDocs(budgetQuery);
      
      const fetchedBudgets: BudgetDisplayItem[] = [];
      budgetsSnapshot.forEach(doc => {
        const budgetData = { id: doc.id, ...doc.data() } as Budget;
        const category = fetchedCategoriesMap.get(budgetData.categoryId);
        const categoryName = category?.name || 'Uncategorized';
        
        // Check budget status using the utility function
        const { status, message } = checkBudgetStatus(budgetData, categoryName);
        
        fetchedBudgets.push({
          ...budgetData,
          categoryName,
          categoryIcon: category?.icon,
          status,
          statusMessage: message
        });
      });
      setBudgets(fetchedBudgets);
      
      // Apply filters
      applyFilters(fetchedBudgets);

    } catch (error) {
      console.error("Error fetching budget data:", error);
      Alert.alert("Error", "Could not load budget data.");
    } finally {
      setIsLoading(false);
    }
  }, [user, periodFilter, statusFilter]);
  
  // Function to apply filters to budgets
  const applyFilters = useCallback((budgetsToFilter: BudgetDisplayItem[]) => {
    let filtered = [...budgetsToFilter];
    
    // Apply period filter
    if (periodFilter !== 'all') {
      filtered = filtered.filter(budget => budget.period === periodFilter);
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(budget => {
        if (statusFilter === 'active') {
          return budget.isActive !== false; // undefined or true means active
        } else if (statusFilter === 'completed') {
          return budget.isActive === false;
        }
        return true;
      });
    }
    
    setFilteredBudgets(filtered);
  }, [periodFilter, statusFilter]);
  
  // Apply filters when budgets or filters change
  useEffect(() => {
    applyFilters(budgets);
  }, [budgets, applyFilters]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Function to view budget history
  const viewBudgetHistory = async (budget: BudgetDisplayItem) => {
    setSelectedBudget(budget);
    setIsLoadingHistory(true);
    
    try {
      // Fetch budget history
      const history = await getBudgetHistory(budget.id);
      setBudgetHistory(history);
      
      // Fetch expenses for this budget
      const expenses = await getExpensesForBudget(budget.id);
      setBudgetExpenses(expenses);
      
      // Show history modal
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Error fetching budget history:', error);
      Alert.alert('Error', 'Could not load budget history.');
    } finally {
      setIsLoadingHistory(false);
    }
  };
  
  const formatTimestamp = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return '';
    return timestamp.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const renderBudgetItem = (budget: BudgetDisplayItem) => {
    const percentage = budget.limitAmount > 0 ? (budget.spentAmount / budget.limitAmount) * 100 : 0;
    const isOverBudget = percentage > 100;
    
    // Determine progress bar color based on budget status
    let progressColor = theme.colors.primary;
    if (budget.status === 'warning') {
      progressColor = theme.colors.warning;
    } else if (budget.status === 'high-warning') {
      progressColor = '#FF6F00'; // Darker orange for high warning
    } else if (budget.status === 'danger') {
      progressColor = theme.colors.danger;
    } else if (budget.status === 'exceeded') {
      progressColor = theme.colors.error;
    }

    const periodText = budget.period.charAt(0).toUpperCase() + budget.period.slice(1);
    const dateRangeText = `${formatTimestamp(budget.startDate)} - ${formatTimestamp(budget.endDate)}`;
    
    // Check if budget is active or completed
    const isActive = budget.isActive !== false; // undefined or true means active

    return (
      <View style={[styles.budgetItem, { backgroundColor: theme.colors.card }]}>
        <View style={styles.budgetHeader}>
          <View style={styles.categoryContainer}>
            <View
              style={[
                styles.categoryIcon,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Ionicons
                name={(budget.categoryIcon as any) || "wallet-outline"}
                size={20}
                color="white"
              />
            </View>
            <View>
              <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                {budget.categoryName}
              </Text>
              {!isActive && (
                <Text style={[styles.completedBadge, { color: theme.colors.textLight }]}>
                  Completed
                </Text>
              )}
            </View>
          </View>
          <View style={styles.budgetActions}>
            {budget.previousPeriodIds && budget.previousPeriodIds.length > 0 && (
              <TouchableOpacity 
                style={styles.historyButton} 
                onPress={() => viewBudgetHistory(budget)}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              onPress={() => router.push({ pathname: '/screens/EditBudgetScreen', params: { budgetId: budget.id } })}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={20}
                color={theme.colors.textLight}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.budgetDetailsContainer}>
          <View style={styles.budgetTexts}>
            <Text style={[styles.spentAmount, { color: theme.colors.text }]}>
              ₦{budget.spentAmount.toLocaleString()} Spent
            </Text>
            <Text style={[styles.limitAmount, { color: theme.colors.textLight }]}>
              / ₦{budget.limitAmount.toLocaleString()}
            </Text>
          </View>
          <View style={styles.periodContainer}>
            <Text style={[styles.periodText, { color: theme.colors.textLight }]}>{periodText}</Text>
            <Text style={[styles.dateRangeText, { color: theme.colors.textLight }]}>{dateRangeText}</Text>
          </View>
        </View>

        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              { backgroundColor: theme.colors.border },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: progressColor,
                  width: `${Math.min(percentage, 100)}%`,
                },
              ]}
            />
          </View>
          <Text
            style={[
              styles.percentageText,
              {
                color: isOverBudget
                  ? theme.colors.error
                  : theme.colors.textLight,
              },
            ]}
          >
            {percentage.toFixed(0)}%
          </Text>
        </View>

        {budget.status !== 'normal' && (
          <Text
            style={[styles.statusText, { color: progressColor }]}
          >
            {budget.statusMessage}
          </Text>
        )}
        
        {budget.nextPeriodId && (
          <TouchableOpacity 
            style={[styles.nextPeriodButton, { borderColor: theme.colors.primary }]}
            onPress={() => router.push({ pathname: '/screens/EditBudgetScreen', params: { budgetId: budget.nextPeriodId } })}
          >
            <Text style={[styles.nextPeriodText, { color: theme.colors.primary }]}>
              View Next Period
            </Text>
            <Ionicons name="arrow-forward" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const { totalBudget, totalSpent, totalPercentage } = useMemo(() => {
    const currentTotalBudget = filteredBudgets.reduce(
      (sum, budget) => sum + budget.limitAmount,
      0
    );
    const currentTotalSpent = filteredBudgets.reduce((sum, budget) => sum + budget.spentAmount, 0);
    const currentTotalPercentage = currentTotalBudget > 0 ? (currentTotalSpent / currentTotalBudget) * 100 : 0;
    return {
        totalBudget: currentTotalBudget,
        totalSpent: currentTotalSpent,
        totalPercentage: currentTotalPercentage
    }
  }, [filteredBudgets]);

  // Function to toggle filter modal
  const toggleFilterModal = () => {
    setShowFilterModal(!showFilterModal);
  };
  
  // Function to apply selected filters
  const applySelectedFilters = () => {
    applyFilters(budgets);
    setShowFilterModal(false);
  };
  
  // Function to reset filters
  const resetFilters = () => {
    setPeriodFilter('all');
    setStatusFilter('active');
    applyFilters(budgets);
    setShowFilterModal(false);
  };
  
  // Render history item
  const renderHistoryItem = ({ item }: { item: BudgetHistory }) => {
    return (
      <View style={[styles.historyItem, { backgroundColor: theme.colors.card }]}>
        <View style={styles.historyHeader}>
          <Text style={[styles.historyDate, { color: theme.colors.text }]}>
            {formatTimestamp(item.completedAt)} - Completed
          </Text>
        </View>
        <View style={styles.historyDetails}>
          <Text style={[styles.historyAmount, { color: theme.colors.text }]}>
            ₦{item.spentAmount.toLocaleString()} / ₦{item.limitAmount.toLocaleString()}
          </Text>
          <Text style={[styles.historyPercentage, { 
            color: item.spentAmount > item.limitAmount ? theme.colors.error : theme.colors.success 
          }]}>
            {item.limitAmount > 0 ? ((item.spentAmount / item.limitAmount) * 100).toFixed(0) : 0}%
          </Text>
        </View>
      </View>
    );
  };
  
  if (isLoading) {
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center'}]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{color: theme.colors.text, marginTop: 10}}>Loading budgets...</Text>
        </SafeAreaView>
    )
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Stack.Screen 
        options={{
          title: 'Budgets',
          headerStyle: {
            backgroundColor: theme.colors.background,
          },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: theme.colors.card }]} 
              onPress={toggleFilterModal}
            >
              <Ionicons
                name="funnel-outline"
                size={20}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          ),
        }}
      />

      {isCheckingExpired && (
        <View style={[styles.checkingBanner, { backgroundColor: theme.colors.card }]}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.checkingText, { color: theme.colors.text }]}>Checking for expired budgets...</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {filteredBudgets.length > 0 ? (
          <>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Text style={styles.summaryTitle}>Budget Overview</Text>
              <View style={styles.summaryAmounts}>
                <Text style={styles.summarySpent}>₦{totalSpent.toFixed(2)}</Text>
                <Text style={styles.summaryLimit}>
                  of ₦{totalBudget.toFixed(2)}
                </Text>
              </View>

              <View style={styles.summaryProgressContainer}>
                <View style={styles.summaryProgressBar}>
                  <View
                    style={[
                      styles.summaryProgressFill,
                      { width: `${Math.min(totalPercentage, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.summaryPercentage}>
                  {totalPercentage.toFixed(0)}%
                </Text>
              </View>
              
              {/* Filter indicators */}
              {(periodFilter !== 'all' || statusFilter !== 'all') && (
                <View style={styles.activeFiltersContainer}>
                  <Text style={styles.activeFiltersText}>Filters: </Text>
                  {periodFilter !== 'all' && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>
                        {periodFilter.charAt(0).toUpperCase() + periodFilter.slice(1)}
                      </Text>
                    </View>
                  )}
                  {statusFilter !== 'all' && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>
                        {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={resetFilters}>
                    <Text style={styles.clearFiltersText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.budgetList}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  Category Budgets
                </Text>
                <TouchableOpacity onPress={() => router.push('/screens/AddBudgetScreen')}>
                  <Text
                    style={[styles.addBudgetText, { color: theme.colors.primary }]}
                  >
                    + Add Budget
                  </Text>
                </TouchableOpacity>
              </View>

              {filteredBudgets.map(budget => React.cloneElement(renderBudgetItem(budget), { key: budget.id }))}
            </View>
          </>
        ) : (
          <View style={styles.emptyStateContainer}>
            {budgets.length > 0 ? (
              // No budgets match the current filters
              <>
                <Ionicons name="filter-outline" size={64} color={theme.colors.textLight} />
                <Text style={[styles.emptyStateText, {color: theme.colors.textLight}]}>No budgets match your filters.</Text>
                <TouchableOpacity 
                  style={[styles.addButtonEmpty, {backgroundColor: theme.colors.primary}]} 
                  onPress={resetFilters}
                >
                  <Text style={styles.addButtonEmptyText}>Clear Filters</Text>
                </TouchableOpacity>
              </>
            ) : (
              // No budgets at all
              <>
                <Ionicons name="sad-outline" size={64} color={theme.colors.textLight} />
                <Text style={[styles.emptyStateText, {color: theme.colors.textLight}]}>No budgets set up yet.</Text>
                <TouchableOpacity 
                  style={[styles.addButtonEmpty, {backgroundColor: theme.colors.primary}]} 
                  onPress={() => router.push('/screens/AddBudgetScreen')}
                >
                  <Text style={styles.addButtonEmptyText}>Add Your First Budget</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
      
      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={toggleFilterModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Filter Budgets</Text>
              <TouchableOpacity onPress={toggleFilterModal}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>Period Type</Text>
              <View style={styles.filterOptions}>
                {(['all', 'weekly', 'monthly', 'yearly', 'custom'] as PeriodFilter[]).map((period) => (
                  <TouchableOpacity 
                    key={period}
                    style={[
                      styles.filterOption,
                      periodFilter === period && { backgroundColor: theme.colors.primary }
                    ]}
                    onPress={() => setPeriodFilter(period)}
                  >
                    <Text 
                      style={[
                        styles.filterOptionText,
                        periodFilter === period && { color: 'white' }
                      ]}
                    >
                      {period === 'all' ? 'All' : period.charAt(0).toUpperCase() + period.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>Status</Text>
              <View style={styles.filterOptions}>
                {(['all', 'active', 'completed'] as StatusFilter[]).map((status) => (
                  <TouchableOpacity 
                    key={status}
                    style={[
                      styles.filterOption,
                      statusFilter === status && { backgroundColor: theme.colors.primary }
                    ]}
                    onPress={() => setStatusFilter(status)}
                  >
                    <Text 
                      style={[
                        styles.filterOptionText,
                        statusFilter === status && { color: 'white' }
                      ]}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: theme.colors.border }]}
                onPress={resetFilters}
              >
                <Text style={styles.modalButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={applySelectedFilters}
              >
                <Text style={[styles.modalButtonText, { color: 'white' }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* History Modal */}
      <Modal
        visible={showHistoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {selectedBudget?.categoryName} Budget History
              </Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            {isLoadingHistory ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading history...</Text>
              </View>
            ) : (
              <>
                {budgetHistory.length > 0 ? (
                  <FlatList
                    data={budgetHistory}
                    renderItem={renderHistoryItem}
                    keyExtractor={(item) => item.id}
                    style={styles.historyList}
                  />
                ) : (
                  <View style={styles.emptyHistoryContainer}>
                    <Text style={[styles.emptyHistoryText, { color: theme.colors.textLight }]}>
                      No history available for this budget.
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  checkingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
  },
  checkingText: {
    marginLeft: 8,
    fontSize: 12,
  },
  summaryCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
  },
  summaryTitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
  },
  summaryAmounts: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 10,
  },
  summarySpent: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
  },
  summaryLimit: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 16,
    marginLeft: 5,
  },
  summaryProgressContainer: {
    marginTop: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  summaryProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  summaryProgressFill: {
    height: "100%",
    backgroundColor: "white",
    borderRadius: 4,
  },
  summaryPercentage: {
    color: "white",
    marginLeft: 10,
    fontWeight: "500",
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    flexWrap: 'wrap',
  },
  activeFiltersText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  filterBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 6,
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 10,
  },
  clearFiltersText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 10,
    textDecorationLine: 'underline',
  },
  budgetList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 4,
  },
  addBudgetText: {
    fontSize: 14,
    fontWeight: "500",
  },
  budgetItem: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  categoryContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryName: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "500",
  },
  completedBadge: {
    marginLeft: 10,
    fontSize: 10,
    fontStyle: 'italic',
  },
  budgetActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyButton: {
    marginRight: 15,
  },
  budgetDetailsContainer: {
    marginTop: 5,
  },
  budgetTexts: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  spentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  limitAmount: {
    fontSize: 14,
    marginLeft: 5,
  },
  periodContainer: {
    alignItems: 'flex-end',
  },
  periodText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  dateRangeText: {
    fontSize: 10,
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  percentageText: {
    marginLeft: 10,
    fontWeight: "500",
  },
  overBudgetText: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: "500",
  },
  nextPeriodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  nextPeriodText: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 5,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 50,
  },
  emptyStateText: {
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  addButtonEmpty: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  addButtonEmptyText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  filterOptionText: {
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // History modal styles
  historyList: {
    maxHeight: 400,
  },
  historyItem: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  historyHeader: {
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '500',
  },
  historyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyAmount: {
    fontSize: 16,
  },
  historyPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
  },
  emptyHistoryContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyHistoryText: {
    textAlign: 'center',
  },
});

export default BudgetScreen;
