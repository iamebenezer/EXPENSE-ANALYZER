import { Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Expense } from '../models/types';

/**
 * Utility functions for expense management
 */

/**
 * Get expenses for a specific date range
 * @param userId The user ID
 * @param startDate The start date of the range
 * @param endDate The end date of the range
 * @param categoryId Optional category ID to filter by
 * @returns An array of expenses for the date range
 */
export const getExpensesForDateRange = async (
  userId: string,
  startDate: Date,
  endDate: Date,
  categoryId?: string
): Promise<Expense[]> => {
  try {
    // Create base query
    const expensesRef = collection(db, 'expenses');
    let q;
    
    if (categoryId) {
      // Query with category filter
      q = query(
        expensesRef,
        where('userId', '==', userId),
        where('categoryId', '==', categoryId),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
      );
    } else {
      // Query without category filter
      q = query(
        expensesRef,
        where('userId', '==', userId),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
      );
    }
    
    const expensesSnapshot = await getDocs(q);
    const expenses: Expense[] = [];
    
    expensesSnapshot.forEach((doc: any) => {
      expenses.push({ id: doc.id, ...doc.data() } as Expense);
    });
    
    // Sort by date (newest first)
    expenses.sort((a: Expense, b: Expense) => b.date.toMillis() - a.date.toMillis());
    
    return expenses;
  } catch (error) {
    console.error('Error getting expenses for date range:', error);
    return [];
  }
};

/**
 * Get expenses grouped by category for a specific date range
 * @param userId The user ID
 * @param startDate The start date of the range
 * @param endDate The end date of the range
 * @returns An object with category IDs as keys and arrays of expenses as values
 */
export const getExpensesByCategory = async (
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Record<string, Expense[]>> => {
  try {
    const expenses = await getExpensesForDateRange(userId, startDate, endDate);
    const expensesByCategory: Record<string, Expense[]> = {};
    
    expenses.forEach((expense: Expense) => {
      if (!expensesByCategory[expense.categoryId]) {
        expensesByCategory[expense.categoryId] = [];
      }
      expensesByCategory[expense.categoryId].push(expense);
    });
    
    return expensesByCategory;
  } catch (error) {
    console.error('Error grouping expenses by category:', error);
    return {};
  }
};

/**
 * Calculate total expenses for a specific date range
 * @param userId The user ID
 * @param startDate The start date of the range
 * @param endDate The end date of the range
 * @param categoryId Optional category ID to filter by
 * @returns The total amount spent in the date range
 */
export const calculateTotalExpenses = async (
  userId: string,
  startDate: Date,
  endDate: Date,
  categoryId?: string
): Promise<number> => {
  try {
    const expenses = await getExpensesForDateRange(userId, startDate, endDate, categoryId);
    return expenses.reduce((total: number, expense: Expense) => total + expense.amount, 0);
  } catch (error) {
    console.error('Error calculating total expenses:', error);
    return 0;
  }
};

/**
 * Get expenses for different time periods (daily, weekly, monthly, yearly)
 * @param userId The user ID
 * @param period The time period to get expenses for
 * @param date The reference date (defaults to current date)
 * @returns An array of expenses for the specified period
 */
export const getExpensesForPeriod = async (
  userId: string,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  date: Date = new Date()
): Promise<Expense[]> => {
  try {
    let startDate: Date;
    let endDate: Date;
    
    switch (period) {
      case 'daily':
        // Start from beginning of the day
        startDate = new Date(date.getTime());
        startDate.setHours(0, 0, 0, 0);

        // End at end of the day
        endDate = new Date(date.getTime());
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'weekly':
        // Start from Sunday of current week
        startDate = new Date(date.getTime());
        startDate.setDate(date.getDate() - date.getDay());
        startDate.setHours(0, 0, 0, 0);

        // End on Saturday of current week
        endDate = new Date(startDate.getTime());
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'yearly':
        // Start from January 1st of current year
        startDate = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
        
        // End on December 31st of current year
        endDate = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
        
      case 'monthly':
      default:
        // Start from 1st day of current month
        startDate = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
        
        // End on last day of current month
        endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
    }
    
    return await getExpensesForDateRange(userId, startDate, endDate);
  } catch (error) {
    console.error(`Error getting ${period} expenses:`, error);
    return [];
  }
};

/**
 * Get the top spending categories for a specific date range
 * @param userId The user ID
 * @param startDate The start date of the range
 * @param endDate The end date of the range
 * @param limit The maximum number of categories to return (default: 5)
 * @returns An array of objects with categoryId and totalAmount
 */
export const getTopSpendingCategories = async (
  userId: string,
  startDate: Date,
  endDate: Date,
  limit: number = 5
): Promise<Array<{ categoryId: string; totalAmount: number }>> => {
  try {
    const expensesByCategory = await getExpensesByCategory(userId, startDate, endDate);
    
    // Calculate total amount for each category
    const categoryTotals: Array<{ categoryId: string; totalAmount: number }> = [];
    for (const categoryId in expensesByCategory) {
      if (expensesByCategory.hasOwnProperty(categoryId)) {
        const expenses = expensesByCategory[categoryId];
        const totalAmount = expenses.reduce((total: number, expense: Expense) => total + expense.amount, 0);
        categoryTotals.push({ categoryId, totalAmount });
      }
    }
    
    // Sort by total amount (highest first) and limit the results
    return categoryTotals
      .sort((a: { categoryId: string; totalAmount: number }, b: { categoryId: string; totalAmount: number }) => b.totalAmount - a.totalAmount)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting top spending categories:', error);
    return [];
  }
};

/**
 * Compare expenses between two time periods
 * @param userId The user ID
 * @param currentStartDate The start date of the current period
 * @param currentEndDate The end date of the current period
 * @param previousStartDate The start date of the previous period
 * @param previousEndDate The end date of the previous period
 * @returns An object with the total amounts and percentage change
 */
export const compareExpensePeriods = (
  userId: string,
  currentStartDate: Date,
  currentEndDate: Date,
  previousStartDate: Date,
  previousEndDate: Date
): Promise<{ currentTotal: number; previousTotal: number; percentageChange: number }> => {
  return calculateTotalExpenses(userId, currentStartDate, currentEndDate)
    .then((currentTotal: number) => {
      return calculateTotalExpenses(userId, previousStartDate, previousEndDate)
        .then((previousTotal: number) => {
          // Calculate percentage change
          let percentageChange = 0;
          if (previousTotal > 0) {
            percentageChange = ((currentTotal - previousTotal) / previousTotal) * 100;
          }

          return {
            currentTotal,
            previousTotal,
            percentageChange
          };
        });
    })
    .catch((error: any) => {
      console.error('Error comparing expense periods:', error);
      return {
        currentTotal: 0,
        previousTotal: 0,
        percentageChange: 0
      };
    });
};

/**
 * Get expense trends over time (daily, weekly, or monthly aggregation)
 * @param userId The user ID
 * @param startDate The start date of the range
 * @param endDate The end date of the range
 * @param aggregation The time unit to aggregate by
 * @returns An array of objects with date and totalAmount
 */
export const getExpenseTrends = (
  userId: string,
  startDate: Date,
  endDate: Date,
  aggregation: 'daily' | 'weekly' | 'monthly'
): Promise<Array<{ date: Date; totalAmount: number }>> => {
  return getExpensesForDateRange(userId, startDate, endDate)
    .then((expenses: Expense[]) => {
      const trends: Record<string, number> = {};

      // Helper function to pad numbers with leading zeros (ES5 compatible)
      const padZero = (num: number): string => {
        return num < 10 ? '0' + num : String(num);
      };

      // Group expenses by the specified time unit
      expenses.forEach((expense: Expense) => {
        const expenseDate = expense.date.toDate();
        let key: string;

        switch (aggregation) {
          case 'daily':
            // Format: YYYY-MM-DD
            key = `${expenseDate.getFullYear()}-${padZero(expenseDate.getMonth() + 1)}-${padZero(expenseDate.getDate())}`;
            break;

          case 'weekly':
            // Get the first day of the week (Sunday)
            const weekStart = new Date(expenseDate.getTime());
            weekStart.setDate(expenseDate.getDate() - expenseDate.getDay());
            // Format: YYYY-WW (year and week number)
            key = `${weekStart.getFullYear()}-W${Math.ceil((weekStart.getDate() + weekStart.getDay()) / 7)}`;
            break;

          case 'monthly':
          default:
            // Format: YYYY-MM
            key = `${expenseDate.getFullYear()}-${padZero(expenseDate.getMonth() + 1)}`;
            break;
        }

        if (!trends[key]) {
          trends[key] = 0;
        }
        trends[key] += expense.amount;
      });

      // Convert to array format (ES5 compatible)
      const result: Array<{ date: Date; totalAmount: number }> = [];
      for (const dateKey in trends) {
        if (trends.hasOwnProperty(dateKey)) {
          const totalAmount = trends[dateKey];
          let date: Date;

          if (aggregation === 'weekly') {
            // Parse year and week number
            const parts = dateKey.split('-');
            const year = parts[0];
            const weekPart = parts[1];
            const weekNumber = parseInt(weekPart.substring(1));

            // Create date for the first day of that week
            date = new Date(parseInt(year), 0, 1 + (weekNumber - 1) * 7);
          } else if (aggregation === 'monthly') {
            // Parse year and month
            const parts = dateKey.split('-');
            const year = parts[0];
            const month = parts[1];
            date = new Date(parseInt(year), parseInt(month) - 1, 1);
          } else {
            // Parse full date for daily aggregation
            date = new Date(dateKey);
          }

          result.push({ date, totalAmount });
        }
      }

      // Sort by date
      return result.sort((a: { date: Date; totalAmount: number }, b: { date: Date; totalAmount: number }) => a.date.getTime() - b.date.getTime());
    })
    .catch((error: any) => {
      console.error(`Error getting expense trends with ${aggregation} aggregation:`, error);
      return [];
    });
};

/**
 * Export utilities for generating reports
 */

// Date range presets
export const getDateRangePresets = () => {
  const now = new Date();
  const presets = {
    last7Days: {
      label: 'Last 7 Days',
      startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      endDate: now
    },
    last30Days: {
      label: 'Last 30 Days',
      startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endDate: now
    },
    last3Months: {
      label: 'Last 3 Months',
      startDate: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
      endDate: now
    },
    last6Months: {
      label: 'Last 6 Months',
      startDate: new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
      endDate: now
    },
    lastYear: {
      label: 'Last Year',
      startDate: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
      endDate: now
    },
    thisMonth: {
      label: 'This Month',
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0)
    },
    thisYear: {
      label: 'This Year',
      startDate: new Date(now.getFullYear(), 0, 1),
      endDate: new Date(now.getFullYear(), 11, 31)
    }
  };

  return presets;
};