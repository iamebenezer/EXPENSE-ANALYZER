"use client";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Platform, // Added Platform for potential OS-specific styling
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, Theme } from "../../../context/ThemeContext";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { db } from '../../../firebaseConfig';
import { collection, query, where, getDocs, orderBy, limit, Timestamp, or } from 'firebase/firestore'; // Added 'or'
import { Expense, Category, Budget } from '../../../models/types';
import { PieChart, LineChart } from 'react-native-chart-kit';
import * as Animatable from 'react-native-animatable'; // Import Animatable
import { getBudgetNotifications } from '../../../utils/notificationUtils';

// Extended Expense interface with type property
interface ExtendedExpense extends Expense {
  type?: 'income' | 'expense';
}

// Interface for pie chart data
interface DonutChartData {
  label: string;
  value: number;
  color: string;
  legendFontColor?: string;
  legendFontSize?: number;
}

// Utility function to format date
const formatDate = (date: Date): string => {
  // More user-friendly date format
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

// Utility function to get a canonical date string (YYYY-MM-DD)
const getCanonicalDateString = (date: Date): string => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    // console.warn("getCanonicalDateString received an invalid date:", date); // Optional: for debugging
    return 'invalid-date-string'; // Return a string that is unlikely to match actual data
  }
  return date.toISOString().split('T')[0];
};

// Utility function to get Date objects for the last 7 days (midnight)
const getLast7DaysDates = (): Date[] => {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0); // Normalize to midnight
    return date;
  }).reverse(); // Oldest to newest
};

// Utility function to get last 6 months for chart (month names and year-month keys)
const getPast6MonthsInfo = (): { labels: string[], yearMonthKeys: string[] } => {
  const labels: string[] = [];
  const yearMonthKeys: string[] = []; // 'YYYY-MM'
  const currentDate = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
    yearMonthKeys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return { labels, yearMonthKeys };
};

// Utility function to generate random colors for chart elements
const getRandomColor = (): string => {
  // Predefined colors that work well together
  const colors = [
    '#1E88E5', // Primary blue
    '#42A5F5', // Lighter blue
    '#FF9800', // Orange
    '#4CAF50', // Green
    '#9C27B0', // Purple
    '#F44336', // Red
    '#00BCD4', // Cyan
    '#FFEB3B', // Yellow
    '#795548', // Brown
    '#607D8B', // Blue Grey
  ];
  
  return colors[Math.floor(Math.random() * colors.length)];
};

// Enhanced Bar Chart Component with better visuals and animations
const SimpleBarChart = ({ data }: { data: { x: string; y: number }[] }) => {
  const { theme } = useTheme();

  if (!data || data.length === 0) {
    return <Text style={{ color: theme.colors.textLight, textAlign: 'center', paddingVertical: 20 }}>No data for chart</Text>;
  }

  const maxValue = Math.max(...data.map(d => d.y), 0); 
  
  // Generate gradient colors based on values (higher values = more intense color)
  const getBarColor = (value: number, index: number) => {
    // Use a color gradient based on the day of week
    const colors = [
      '#4285F4', // Monday - Blue
      '#34A853', // Tuesday - Green
      '#FBBC05', // Wednesday - Yellow
      '#EA4335', // Thursday - Red
      '#8F44AD', // Friday - Purple
      '#16A085', // Saturday - Teal
      '#F39C12', // Sunday - Orange
    ];
    return colors[index % colors.length];
  };

  return (
    <Animatable.View animation="fadeInUp" duration={600} style={{ paddingHorizontal: theme.spacing.sm }}>
      {data.map((item, index) => {
        const percentage = maxValue > 0 ? (item.y / maxValue) * 100 : 0;
        const barColor = getBarColor(percentage, index);
        
        return (
          <Animatable.View 
            key={index} 
            animation="fadeInUp" 
            duration={500} 
            delay={index * 100} 
            style={{ marginBottom: theme.spacing.md }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: theme.colors.text, fontSize: theme.fontSizes.sm, fontWeight: '600' }}>{item.x}</Text>
              <Text style={{ color: barColor, fontSize: theme.fontSizes.sm, fontWeight: '700' }}>
                ₦{item.y.toLocaleString()}
              </Text>
            </View>
            <View style={{ 
              height: 14, 
              backgroundColor: theme.themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', 
              borderRadius: theme.borderRadius.sm,
              overflow: 'hidden',
              padding: 2,
            }}>
              <Animatable.View 
                animation="slideInLeft" 
                duration={1000} 
                delay={index * 100 + 300}
                style={{ 
                  width: `${percentage}%`, 
                  height: '100%', 
                  backgroundColor: barColor,
                  borderRadius: theme.borderRadius.xs,
                  shadowColor: barColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              />
            </View>
            {/* The redundant text element displaying item.y has been removed for a cleaner look. */}
          </Animatable.View>
        );
      })}
    </Animatable.View>
  );
};

// Enhanced Component for rendering individual budget status with better visuals and animations
const BudgetStatusItem = ({ budget, categoryName, theme, index }: { budget: Budget, categoryName: string, theme: Theme, index: number }) => {
  const progress = budget.limitAmount > 0 ? (budget.spentAmount / budget.limitAmount) * 100 : 0;
  const progressClamped = Math.min(Math.max(progress, 0), 100); 
  const isOverBudget = budget.spentAmount > budget.limitAmount;

  // Calculate remaining amount and percentage
  const remainingAmount = Math.max(budget.limitAmount - budget.spentAmount, 0);
  const remainingPercentage = 100 - progressClamped;
  const overBudgetAmount = isOverBudget ? budget.spentAmount - budget.limitAmount : 0;

  // Determine status color based on percentage
  const getStatusColor = () => {
    if (isOverBudget) return theme.colors.error;
    if (progressClamped > 85) return '#FF9800'; // Warning orange
    if (progressClamped > 60) return '#FFC107'; // Attention yellow
    return theme.colors.primary; // Good
  };
  
  const statusColor = getStatusColor();

  // Get status text based on percentage
  const getStatusText = () => {
    if (isOverBudget) return 'Over Budget';
    if (progressClamped > 85) return 'Almost Full';
    if (progressClamped > 60) return 'Watch Spending';
    if (progressClamped > 30) return 'On Track';
    return 'Under Budget';
  };

  const statusText = getStatusText();

  const itemStyles = StyleSheet.create({
    budgetItem: {
      backgroundColor: theme.colors.card,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0.15,
      shadowRadius: 4,
      elevation: Platform.OS === 'android' ? 3 : 0,
      borderLeftWidth: 4,
      borderLeftColor: statusColor,
    },
    budgetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    budgetTextContainer: {
      flex: 1,
      marginBottom: theme.spacing.sm,
    },
    budgetCategory: {
      fontSize: theme.fontSizes.md,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs / 2,
    },
    budgetAmountsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.xs,
    },
    budgetAmount: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.textLight,
      marginBottom: theme.spacing.xxs,
    },
    budgetDates: {
      fontSize: theme.fontSizes.xs,
      color: theme.colors.textLight,
      marginTop: theme.spacing.xs / 2,
      fontStyle: 'italic',
    },
    progressBarInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
    },
    progressPercentage: {
      fontSize: theme.fontSizes.sm,
      color: statusColor,
      fontWeight: '600',
    },
    statusBadge: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: `${statusColor}20`, // 20% opacity
    },
    statusText: {
      color: statusColor,
      fontSize: theme.fontSizes.xs,
      fontWeight: 'bold',
    },
    progressBarContainer: {
      marginTop: theme.spacing.xs,
    },
    progressBarBackground: {
      height: 10, // Slightly thicker progress bar for better visibility
      backgroundColor: theme.themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      borderRadius: theme.borderRadius.sm,
      overflow: 'hidden',
      padding: 1, // Smaller inner padding
    },
    progressBarFill: {
      height: '100%',
      borderRadius: theme.borderRadius.xs,
    },
    overBudgetIndicator: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: theme.colors.error,
      borderTopRightRadius: theme.borderRadius.xs,
      borderBottomRightRadius: theme.borderRadius.xs,
    },
  });

  return (
    <Animatable.View 
      animation="fadeInUp" 
      duration={600} 
      delay={index * 120} 
      style={itemStyles.budgetItem}
    >
      <View style={itemStyles.budgetHeader}>
        <Text style={itemStyles.budgetCategory}>{categoryName}</Text>
        <View style={itemStyles.statusBadge}>
          <Text style={itemStyles.statusText}>{statusText}</Text>
        </View>
      </View>
      
      <View style={itemStyles.budgetAmountsContainer}>
        <View>
          <Text style={itemStyles.budgetAmount}>{`Limit: ₦${budget.limitAmount.toLocaleString()}`}</Text>
          <Text style={[itemStyles.budgetAmount, isOverBudget ? {color: theme.colors.error, fontWeight: '600'} : {}]}>
            {`Spent: ₦${budget.spentAmount.toLocaleString()}`}
          </Text>
          {!isOverBudget ? (
            <Text style={[itemStyles.budgetAmount, { color: theme.colors.success, fontWeight: '600' }]}>
              {`Remaining: ₦${remainingAmount.toLocaleString()}`}
            </Text>
          ) : (
            <Text style={[itemStyles.budgetAmount, { color: theme.colors.error, fontWeight: '600' }]}>
              {`Over by: ₦${overBudgetAmount.toLocaleString()}`}
            </Text>
          )}
        </View>
        
        {budget.startDate && budget.endDate && (
          <Text style={itemStyles.budgetDates}>
            {`${formatDate(budget.startDate.toDate())} - ${formatDate(budget.endDate.toDate())}`}
          </Text>
        )}
      </View>
      
      <View style={itemStyles.progressBarContainer}>
        <View style={itemStyles.progressBarInfo}>
          <Text style={itemStyles.progressPercentage}>{`${progressClamped.toFixed(1)}% Used`}</Text>
          {!isOverBudget && (
            <Text style={{ color: theme.colors.textLight, fontSize: theme.fontSizes.sm }}>
              {`${remainingPercentage.toFixed(1)}% Left`}
            </Text>
          )}
        </View>
        <View style={itemStyles.progressBarBackground}>
          <Animatable.View 
            animation="slideInLeft"
            duration={1000}
            delay={index * 150 + 200}
            style={[
              itemStyles.progressBarFill,
              { 
                width: `${progressClamped}%`,
                backgroundColor: statusColor,
                shadowColor: statusColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 2,
                elevation: 2,
              }
            ]}
          />
          {isOverBudget && <View style={itemStyles.overBudgetIndicator} />}
        </View>
      </View>
    </Animatable.View>
  );
};

const DashboardScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [expenses, setExpenses] = useState<ExtendedExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [totalBalance, setTotalBalance] = useState(0); // This might need recalculation based on actual income/expense logic
  const [recentTransactions, setRecentTransactions] = useState<ExtendedExpense[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<DonutChartData[]>([]);
  const [dailyExpenses, setDailyExpenses] = useState<{x: string, y: number}[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<{month: string, amount: number}[]>([]);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    status: 'normal' | 'warning' | 'danger' | 'exceeded';
    message: string;
    percentage: number;
    timestamp: Date;
  }>>([]);

  
  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    try {
      setError(null);
      // setLoading(true); // Already handled by refreshing or initial load
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoTimestamp = Timestamp.fromDate(sevenDaysAgo);

      // Fetch Expenses
      const expensesQuery = query(
        collection(db, 'expenses'), 
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const expensesSnapshot = await getDocs(expensesQuery);
      const fetchedExpenses: ExtendedExpense[] = [];
      expensesSnapshot.forEach(doc => fetchedExpenses.push({ id: doc.id, ...doc.data(), type: 'expense' } as ExtendedExpense));
      setExpenses(fetchedExpenses);

      // Fetch Categories (consistent with other screens)
      const categoriesQuery = query(
        collection(db, 'categories'),
        or(
          where('isDefault', '==', true),
          where('userId', '==', user.uid)
        ),
        orderBy('name', 'asc')
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const fetchedCategories: Category[] = [];
      categoriesSnapshot.forEach(doc => fetchedCategories.push({ id: doc.id, ...doc.data() } as Category));
      setCategories(fetchedCategories);

      // Fetch Budgets
      const budgetsQuery = query(collection(db, 'budgets'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
      const budgetsSnapshot = await getDocs(budgetsQuery);
      const fetchedBudgets: Budget[] = [];
      budgetsSnapshot.forEach(doc => {
        const budgetData = { id: doc.id, ...doc.data() } as Budget;
        fetchedBudgets.push(budgetData);
      });

      // Calculate actual spent amount for each budget based on expenses
      const updatedBudgets = fetchedBudgets.map(budget => {
        // Get budget date range
        const budgetStartDate = budget.startDate.toDate();
        const budgetEndDate = budget.endDate.toDate();
        
        // Filter expenses that fall within this budget's date range and category
        const budgetExpenses = fetchedExpenses.filter(expense => {
          const expenseDate = expense.date.toDate();
          return (
            expense.categoryId === budget.categoryId &&
            expenseDate >= budgetStartDate &&
            expenseDate <= budgetEndDate
          );
        });
        
        // Calculate total spent for this budget
        const spentAmount = budgetExpenses.reduce((total, expense) => total + expense.amount, 0);
        
        // Log for debugging
        console.log(`Budget for ${fetchedCategories.find(c => c.id === budget.categoryId)?.name || 'Unknown'}:`);
        console.log(`- Date range: ${budgetStartDate.toLocaleDateString()} to ${budgetEndDate.toLocaleDateString()}`);
        console.log(`- Found ${budgetExpenses.length} matching expenses totaling ₦${spentAmount}`);
        console.log(`- Previous spent amount: ₦${budget.spentAmount}`);
        
        // Return updated budget with calculated spent amount
        return {
          ...budget,
          spentAmount: spentAmount
        };
      });
      
      // Update budgets state with the calculated spent amounts
      setBudgets(updatedBudgets);
      
      // Generate budget notifications
      const budgetNotifications = getBudgetNotifications(updatedBudgets, fetchedCategories);
      setNotifications(budgetNotifications);
      
      // Also update the expenses by category to match the budget calculations
      const categoryExpenseMap = new Map<string, number>();
      
      // Initialize with all categories at 0
      fetchedCategories.forEach(category => {
        categoryExpenseMap.set(category.id!, 0);
      });
      
      // Sum expenses by category ID (not name) for more accurate tracking
      fetchedExpenses.forEach(expense => {
        const categoryId = expense.categoryId;
        if (categoryId) {
          categoryExpenseMap.set(categoryId, (categoryExpenseMap.get(categoryId) || 0) + expense.amount);
        }
      });
      
      // Convert to the format needed for pie chart, using category names for display
      const pieChartData: DonutChartData[] = [];
      categoryExpenseMap.forEach((value, categoryId) => {
        if (value > 0) { // Only include categories with expenses
          const category = fetchedCategories.find(c => c.id === categoryId);
          if (category) {
            pieChartData.push({
              label: category.name,
              value: value,
              color: category.color || getRandomColor(),
              legendFontColor: theme.colors.text,
              legendFontSize: 12
            });
          }
        }
      });
      
      // Sort by value in descending order
      pieChartData.sort((a, b) => b.value - a.value);
      
      setExpensesByCategory(pieChartData);

      // Process Data for UI
      // Recent Transactions (last 5)
      setRecentTransactions(fetchedExpenses.slice(0, 5));

      // Daily Expenses (Last 7 Days for Bar Chart)
      const dailyMap = new Map<string, number>(); // Key: 'YYYY-MM-DD'
      const last7DaysDates = getLast7DaysDates(); // Array of Date objects (midnight, oldest to newest)

      last7DaysDates.forEach(date => {
        const canonicalDateStr = getCanonicalDateString(date);
        dailyMap.set(canonicalDateStr, 0);
      });
      
      const firstDayOfChart = last7DaysDates[0]; // Oldest date in the 7-day range (midnight)

      fetchedExpenses
        .filter(exp => {
          const expenseDate = exp.date.toDate();
          // Create a new Date object for comparison to avoid mutating the original expenseDate from fetchedExpenses
          const expenseDateNormalized = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), expenseDate.getDate());
          return expenseDateNormalized >= firstDayOfChart;
        })
        .forEach(expense => {
          const expenseDate = expense.date.toDate();
          // Create a new Date object for key generation, normalized to midnight
          const expenseDateForKey = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), expenseDate.getDate());
          const expenseDateCanonicalStr = getCanonicalDateString(expenseDateForKey);

          if (dailyMap.has(expenseDateCanonicalStr)) {
            dailyMap.set(expenseDateCanonicalStr, (dailyMap.get(expenseDateCanonicalStr) || 0) + expense.amount);
          }
        });

      const barChartData = last7DaysDates.map(date => ({
        x: date.toLocaleDateString('en-US', { weekday: 'short' }), // e.g., "Sat"
        y: dailyMap.get(getCanonicalDateString(date)) || 0,
      }));
      setDailyExpenses(barChartData);
      
      // Monthly Expenses (Last 6 Months for Line Chart)
      const { labels: last6MonthLabels, yearMonthKeys: last6YearMonthKeys } = getPast6MonthsInfo();
      const monthlyMap = new Map<string, number>(); // Key: 'YYYY-MM'
      last6YearMonthKeys.forEach(key => monthlyMap.set(key, 0));

      const firstMonthToFetch = new Date();
      // Ensure we are at the start of the month that is 5 months ago (to make a 6-month window including current)
      firstMonthToFetch.setMonth(firstMonthToFetch.getMonth() - 5);
      firstMonthToFetch.setDate(1); 
      firstMonthToFetch.setHours(0, 0, 0, 0); 
      const firstMonthToFetchTimestamp = Timestamp.fromDate(firstMonthToFetch);

      fetchedExpenses
        .filter(exp => exp.date.toDate() >= firstMonthToFetchTimestamp)
        .forEach(expense => {
          const expenseDate = expense.date.toDate();
          const expenseYearMonthKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
          if (monthlyMap.has(expenseYearMonthKey)) {
            monthlyMap.set(expenseYearMonthKey, (monthlyMap.get(expenseYearMonthKey) || 0) + expense.amount);
          }
        });
      
      const monthlyData = last6YearMonthKeys.map((yearMonthKey, index) => ({
        month: last6MonthLabels[index], // Use the short month name for display
        amount: monthlyMap.get(yearMonthKey) || 0,
      }));
      setMonthlyExpenses(monthlyData);

      // Calculate Total Balance (Example: sum of all expenses - could be more complex)
      // For now, this is a placeholder. A real balance would involve income.
      const totalSpent = fetchedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      setTotalBalance(-totalSpent); // Displaying as negative as it's total expenses
      
      // Budget notifications are already generated earlier in the function

    } catch (err: any) {
      console.error("Error fetching dashboard data: ", err);
      setError(err.message || "Failed to fetch data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, theme.colors.text]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  const styles = getDashboardStyles(theme);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ color: theme.colors.text, marginTop: theme.spacing.md }}>Loading Dashboard...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg }]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
        <Text style={[styles.errorText, {color: theme.colors.error}]}>Oops! Something went wrong.</Text>
        <Text style={[styles.errorDetailText, {color: theme.colors.textLight}]}>{error}</Text>
        <TouchableOpacity onPress={fetchDashboardData} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />}
      >
        {/* Enhanced Header with better animations and profile icon */}
        <Animatable.View animation="fadeIn" duration={800} style={styles.headerContainer}>
          <Animatable.View animation="fadeInLeft" duration={800} delay={200}>
            <Text style={styles.welcomeText}>Welcome Back!</Text>
            <Text style={styles.userName}>{user?.name || "User"}</Text>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          </Animatable.View>
          <Animatable.View animation="fadeInRight" duration={800} delay={300} style={styles.headerActions}>
            {/* Notification Button with Badge */}
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => router.push('/(tabs)/screens/NotificationsScreen')}
            > 
              <Ionicons name="notifications-outline" size={24} color={theme.colors.text} />
              {notifications.length > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{notifications.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* Profile Button */}
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => router.push('/(tabs)/screens/ProfileScreen')}
            > 
              <Ionicons name="person-circle-outline" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </Animatable.View>
        </Animatable.View>

        {/* Total Balance Card */}
        <Animatable.View animation="fadeInUp" duration={600} delay={100} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Expenses</Text>
          <Text style={styles.balanceAmount}>₦{Math.abs(totalBalance).toLocaleString()}</Text>
          <Text style={styles.balanceSubtext}>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
        </Animatable.View>

        {/* Quick Actions */}
        <Animatable.View animation="fadeInUp" duration={600} delay={200} style={styles.quickActionsContainer}>
          <TouchableOpacity style={styles.quickActionButton} onPress={() => router.push('/(tabs)/screens/AddExpenseScreen')}>
            <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.quickActionText}>Add Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionButton} onPress={() => router.push('/(tabs)/screens/AddBudgetScreen')}>
            <Ionicons name="server-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.quickActionText}>Add Budget</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionButton} onPress={() => router.push('/(tabs)/screens/CategoriesScreen')}>
            <Ionicons name="grid-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.quickActionText}>Categories</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionButton} onPress={() => router.push('/(tabs)/screens/ExportReportsScreen')}>
            <Ionicons name="download-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.quickActionText}>Export</Text>
          </TouchableOpacity>
        </Animatable.View>

        {/* Expenses by Category Pie Chart */}
        {expensesByCategory.length > 0 ? (
          <Animatable.View animation="fadeInUp" duration={600} delay={300} style={styles.chartCard}>
            <Text style={styles.cardTitle}>Expenses by Category</Text>
            <View style={{ alignItems: 'center' }}>
              <PieChart
                data={expensesByCategory.map(item => ({ 
                  name: item.label, 
                  population: item.value, 
                  color: item.color, 
                  legendFontColor: theme.colors.text, 
                  legendFontSize: theme.fontSizes.xs 
                }))}
                width={Dimensions.get('window').width - theme.spacing.md * 4}
                height={180}
                chartConfig={{
                  backgroundColor: theme.colors.card,
                  backgroundGradientFrom: theme.colors.card,
                  backgroundGradientTo: theme.colors.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) => theme.colors.text,
                  labelColor: (opacity = 1) => theme.colors.textLight,
                  style: {
                    borderRadius: theme.borderRadius.md,
                  },
                  propsForDots: {
                    r: "4",
                    strokeWidth: "2",
                    stroke: theme.colors.border
                  }
                }}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"10"}
                absolute
                hasLegend={true}
                style={{
                  marginVertical: theme.spacing.xs,
                  borderRadius: theme.borderRadius.md,
                }}
              />
              
              {/* Add total amount below chart */}
              <View style={styles.totalExpenseContainer}>
                <Text style={styles.totalExpenseLabel}>Total Expenses</Text>
                <Text style={styles.totalExpenseAmount}>
                  ₦{expensesByCategory.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                </Text>
              </View>
            </View>
          </Animatable.View>
        ) : (
          <Animatable.View animation="fadeInUp" duration={600} delay={300} style={styles.chartCardEmpty}>
            <Text style={styles.cardTitle}>Expenses by Category</Text>
            <Ionicons name="pie-chart-outline" size={40} color={theme.colors.textLight} style={{ marginVertical: theme.spacing.md}} />
            <Text style={{color: theme.colors.textLight}}>No expense data for chart.</Text>
          </Animatable.View>
        )}

        {/* Daily Expenses Bar Chart */}
        {dailyExpenses.length > 0 ? (
          <Animatable.View animation="fadeInUp" duration={600} delay={400} style={styles.chartCard}>
            <Text style={styles.cardTitle}>Daily Expenses (Last 7 Days)</Text>
            <SimpleBarChart data={dailyExpenses} />
          </Animatable.View>
        ) : (
          <Animatable.View animation="fadeInUp" duration={600} delay={400} style={styles.chartCardEmpty}>
            <Text style={styles.cardTitle}>Daily Expenses (Last 7 Days)</Text>
            <Ionicons name="bar-chart-outline" size={40} color={theme.colors.textLight} style={{ marginVertical: theme.spacing.md}} />
            <Text style={{color: theme.colors.textLight}}>No daily expense data.</Text>
          </Animatable.View>
        )}
        
        {/* Monthly Expense Trend Line Chart */}
        {monthlyExpenses.length > 0 && monthlyExpenses.some(item => item.amount > 0) ? (
          <Animatable.View animation="fadeInUp" duration={600} delay={450} style={styles.chartCard}>
            <Text style={styles.cardTitle}>Monthly Expense Trend</Text>
            <LineChart
              data={{
                labels: monthlyExpenses.map(item => item.month),
                datasets: [
                  {
                    data: monthlyExpenses.map(item => item.amount),
                    color: (opacity = 1) => `rgba(30, 136, 229, ${opacity})`, // Primary blue with opacity
                    strokeWidth: 2
                  }
                ]
              }}
              width={Dimensions.get('window').width - theme.spacing.md * 4} // Adjust width to fit card
              height={180}
              chartConfig={{
                backgroundColor: theme.colors.card,
                backgroundGradientFrom: theme.colors.card,
                backgroundGradientTo: theme.colors.card,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(30, 136, 229, ${opacity})`,
                labelColor: (opacity = 1) => theme.colors.textLight,
                style: {
                  borderRadius: theme.borderRadius.md,
                },
                propsForDots: {
                  r: "4",
                  strokeWidth: "2",
                  stroke: theme.colors.primary
                },
                propsForLabels: {
                  fontSize: theme.fontSizes.xs,
                }
              }}
              bezier // Smooth curve
              style={{
                marginVertical: theme.spacing.xs,
                borderRadius: theme.borderRadius.md,
                paddingRight: theme.spacing.md, // Add padding for labels
              }}
            />
          </Animatable.View>
        ) : (
          <Animatable.View animation="fadeInUp" duration={600} delay={450} style={styles.chartCardEmpty}>
            <Text style={styles.cardTitle}>Monthly Expense Trend</Text>
            <Ionicons name="trending-up-outline" size={40} color={theme.colors.textLight} style={{ marginVertical: theme.spacing.md}} />
            <Text style={{color: theme.colors.textLight}}>No monthly expense data available.</Text>
          </Animatable.View>
        )}

        {/* Recent Transactions */}
        {recentTransactions.length > 0 && (
          <Animatable.View animation="fadeInUp" duration={600} delay={500} style={styles.listCard}>
            <Text style={styles.cardTitle}>Recent Transactions</Text>
            {recentTransactions.map((item, index) => {
              const category = categories.find(c => c.id === item.categoryId);
              return (
                <Animatable.View key={item.id} animation="fadeInUp" duration={500} delay={index * 100} style={styles.transactionItem}>
                  <View style={styles.transactionIconContainer}>
                    <Ionicons name={category?.icon as any || "help-circle-outline"} size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionDescription} numberOfLines={1}>{item.description || category?.name || 'Transaction'}</Text>
                    <Text style={styles.transactionDate}>{formatDate(item.date.toDate())}</Text>
                  </View>
                  <Text style={[styles.transactionAmount, { color: item.type === 'income' ? theme.colors.success : theme.colors.error }]}>
                    {item.type === 'income' ? '+' : '-'}₦{item.amount.toLocaleString()}
                  </Text>
                </Animatable.View>
              );
            })}
          </Animatable.View>
        )}

        {/* Budget Status */}
        {budgets.length > 0 && (
          <Animatable.View animation="fadeInUp" duration={600} delay={600} style={styles.listCard}>
            <Text style={styles.cardTitle}>Budget Status</Text>
            {budgets.map((budget, index) => {
              const category = categories.find(c => c.id === budget.categoryId);
              return (
                <BudgetStatusItem 
                  key={budget.id} 
                  budget={budget} 
                  categoryName={category?.name || 'Unknown Category'} 
                  theme={theme} 
                  index={index}
                />
              );
            })}
          </Animatable.View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

// Define styles within a function to access theme
const getDashboardStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.sm,
    paddingBottom: 80, // Space for bottom tabs
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  welcomeText: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textLight,
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  userName: {
    fontSize: theme.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    letterSpacing: 0.25,
    marginBottom: 2,
  },
  dateText: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textLight,
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)', // Background that works in both themes
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.xs,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    position: 'relative', // For positioning the badge
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: theme.colors.danger,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.background,
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  balanceCard: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    // Add a subtle inner border for depth
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  balanceLabel: {
    fontSize: theme.fontSizes.sm,
    color: 'rgba(255,255,255,0.85)', // Intentionally white for contrast on gradient
    marginBottom: theme.spacing.xs / 2,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: theme.fontSizes.xxl,
    fontWeight: 'bold',
    color: '#FFFFFF', // Intentionally white for contrast on gradient
    marginBottom: theme.spacing.xs,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  balanceSubtext: {
    fontSize: theme.fontSizes.xs,
    color: 'rgba(255,255,255,0.7)', // Intentionally white for contrast on gradient
    letterSpacing: 0.5,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  quickActionButton: {
    backgroundColor: theme.colors.card,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    width: '31%',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
    // Add subtle border for more definition
    borderWidth: 1,
    borderColor: theme.themeMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
  },
  quickActionText: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.primary,
    fontWeight: '600',
    marginLeft: theme.spacing.xs,
  },
  chartCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.themeMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    overflow: 'hidden',
  },
  chartCardEmpty: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    header: {
      padding: theme.spacing.md,
      paddingTop: Platform.OS === 'android' ? theme.spacing.md : 0, // Adjust for Android status bar
      backgroundColor: theme.colors.card,
      borderBottomLeftRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.lg,
      marginBottom: theme.spacing.md,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 8,
    },
    welcomeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    welcomeText: {
      fontSize: theme.fontSizes.lg,
      fontWeight: '600',
      color: theme.colors.textLight,
    },
    userName: {
      fontSize: theme.fontSizes.xxl,
      fontWeight: '800',
      color: theme.colors.text,
      marginTop: theme.spacing.xs,
    },
    totalBalanceContainer: {
      backgroundColor: theme.colors.primary,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 10,
      marginTop: theme.spacing.md,
    },
    balanceLabel: {
      fontSize: theme.fontSizes.md,
      color: theme.colors.white,
      marginBottom: theme.spacing.xs,
      fontWeight: '500',
    },
    balanceAmount: {
      fontSize: theme.fontSizes.xxxl,
      fontWeight: 'bold',
      color: theme.colors.white,
    },
    sectionTitle: {
      fontSize: theme.fontSizes.xl,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      marginHorizontal: theme.spacing.md,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    recentTransactionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.xs,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    recentTransactionText: {
      fontSize: theme.fontSizes.md,
      color: theme.colors.text,
      fontWeight: '600',
    },
    recentTransactionAmount: {
      fontSize: theme.fontSizes.md,
      fontWeight: 'bold',
      color: theme.colors.error,
    },
    recentTransactionDate: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.textLight,
      marginTop: theme.spacing.xs / 2,
    },
    viewAllButton: {
      marginTop: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },
    viewAllButtonText: {
      color: theme.colors.white,
      fontSize: theme.fontSizes.md,
      fontWeight: 'bold',
    },
    chartContainer: {
      alignItems: 'center',
      marginBottom: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    noDataText: {
      color: theme.colors.textLight,
      textAlign: 'center',
      paddingVertical: theme.spacing.md,
      fontSize: theme.fontSizes.md,
      fontStyle: 'italic',
    },
    notificationCard: {
      backgroundColor: theme.colors.card,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: theme.spacing.md,
      borderLeftWidth: 5,
      borderLeftColor: theme.colors.warning,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    },
    notificationIcon: {
      marginRight: theme.spacing.sm,
    },
    notificationText: {
      flex: 1,
      color: theme.colors.text,
      fontSize: theme.fontSizes.sm,
      fontWeight: '500',
    },
    notificationTimestamp: {
      fontSize: theme.fontSizes.xs,
      color: theme.colors.textLight,
      opacity: 0.8,
      marginTop: theme.spacing.xs / 2,
    },
  },
  listCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.themeMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.themeMode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
    marginBottom: theme.spacing.xs / 2,
  },
  transactionIconContainer: {
    backgroundColor: 'rgba(30, 136, 229, 0.15)',
    borderRadius: theme.borderRadius.full,
    padding: theme.spacing.xs,
    marginRight: theme.spacing.sm,
    width: 36, // Smaller icon container
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(30, 136, 229, 0.2)',
  },
  transactionDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  transactionDescription: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 1,
  },
  transactionDate: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textLight,
    letterSpacing: 0.2,
  },
  transactionAmount: {
    fontSize: theme.fontSizes.sm,
    fontWeight: 'bold',
    paddingHorizontal: theme.spacing.xs,
  },
  totalExpenseContainer: {
    marginTop: theme.spacing.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)', // Light background that works in both themes
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  totalExpenseLabel: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textLight,
    marginBottom: 2,
  },
  totalExpenseAmount: {
    fontSize: theme.fontSizes.md,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#F44336', // Red badge for notifications
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'white',
  },
  notificationBadgeText: {
    color: 'white', // Intentionally white for contrast on red badge
    fontSize: 10,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: theme.fontSizes.xl,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  errorDetailText: {
    fontSize: theme.fontSizes.md,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
  },
  retryButtonText: {
    color: '#FFFFFF', // Intentionally white for contrast on primary button
    fontSize: theme.fontSizes.md,
    fontWeight: 'bold',
  },
});

export default DashboardScreen;
