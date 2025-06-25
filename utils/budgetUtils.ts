import { Timestamp, collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Budget, BudgetHistory, Expense } from '../models/types';

/**
 * Utility functions for budget management
 */

/**
 * Calculate the start and end dates for a budget period
 * @param period The budget period type
 * @param customStartDate Optional custom start date (for custom periods)
 * @param customEndDate Optional custom end date (for custom periods)
 * @returns An object with startDate and endDate
 */
export const calculateBudgetDateRange = (
  period: Budget['period'],
  customStartDate?: Date,
  customEndDate?: Date
): { startDate: Date; endDate: Date } => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (period === 'custom' && customStartDate && customEndDate) {
    startDate = new Date(customStartDate);
    endDate = new Date(customEndDate);
  } else {
    switch (period) {
      case 'weekly':
        // Start from Sunday of current week
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        
        // End on Saturday of current week
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'yearly':
        // Start from January 1st of current year
        startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        
        // End on December 31st of current year
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
        
      case 'monthly':
      default:
        // Start from 1st day of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        
        // End on last day of current month
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
    }
  }

  return { startDate, endDate };
};

/**
 * Calculate the next period's date range based on the current period
 * @param currentPeriod The current budget period type
 * @param currentStartDate The current period's start date
 * @param currentEndDate The current period's end date
 * @returns An object with startDate and endDate for the next period
 */
export const calculateNextPeriodDateRange = (
  currentPeriod: Budget['period'],
  currentStartDate: Date,
  currentEndDate: Date
): { startDate: Date; endDate: Date } => {
  let nextStartDate: Date;
  let nextEndDate: Date;

  switch (currentPeriod) {
    case 'weekly':
      // Next week starts the day after the current end date
      nextStartDate = new Date(currentEndDate);
      nextStartDate.setDate(nextStartDate.getDate() + 1);
      nextStartDate.setHours(0, 0, 0, 0);
      
      // Next week ends 7 days after the start
      nextEndDate = new Date(nextStartDate);
      nextEndDate.setDate(nextStartDate.getDate() + 6);
      nextEndDate.setHours(23, 59, 59, 999);
      break;
      
    case 'yearly':
      // Next year starts on January 1st of the next year
      nextStartDate = new Date(currentStartDate.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
      
      // Next year ends on December 31st of the next year
      nextEndDate = new Date(currentStartDate.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
      break;
      
    case 'monthly':
      // Next month starts on the 1st of the next month
      nextStartDate = new Date(currentStartDate);
      nextStartDate.setMonth(nextStartDate.getMonth() + 1);
      nextStartDate.setDate(1);
      nextStartDate.setHours(0, 0, 0, 0);
      
      // Next month ends on the last day of the next month
      nextEndDate = new Date(nextStartDate.getFullYear(), nextStartDate.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
      
    case 'custom':
    default:
      // For custom periods, we can't automatically determine the next period
      // Return null or throw an error
      throw new Error('Cannot automatically calculate next period for custom budget periods');
  }

  return { startDate: nextStartDate, endDate: nextEndDate };
};

/**
 * Check if a budget period has ended
 * @param budget The budget to check
 * @returns Boolean indicating if the budget period has ended
 */
export const hasBudgetPeriodEnded = (budget: Budget): boolean => {
  const now = new Date();
  const endDate = budget.endDate.toDate();
  return now > endDate;
};

/**
 * Archive a completed budget period and create a new one for the next period
 * @param budgetId The ID of the budget to archive
 * @param userId The user ID
 * @returns The ID of the newly created budget for the next period
 */
export const archiveBudgetAndCreateNext = async (budgetId: string, userId: string): Promise<string | null> => {
  try {
    // Get the current budget
    const budgetRef = doc(db, 'budgets', budgetId);
    const budgetSnap = await getDoc(budgetRef);
    
    if (!budgetSnap.exists()) {
      console.error('Budget not found');
      return null;
    }
    
    const currentBudget = { id: budgetSnap.id, ...budgetSnap.data() } as Budget;
    
    // Only proceed if the budget period has ended
    if (!hasBudgetPeriodEnded(currentBudget)) {
      console.log('Budget period has not ended yet');
      return null;
    }
    
    // Create a batch for atomic operations
    const batch = writeBatch(db);
    
    // 1. Create a history record for the completed budget
    const historyData: Omit<BudgetHistory, 'id'> = {
      budgetId: currentBudget.id!,
      userId: currentBudget.userId,
      categoryId: currentBudget.categoryId,
      limitAmount: currentBudget.limitAmount,
      spentAmount: currentBudget.spentAmount,
      period: currentBudget.period,
      startDate: currentBudget.startDate,
      endDate: currentBudget.endDate,
      createdAt: currentBudget.createdAt,
      completedAt: Timestamp.now(),
    };
    
    // For non-custom periods, create a new budget for the next period
    if (currentBudget.period !== 'custom') {
      try {
        // Calculate the next period's date range
        const { startDate, endDate } = calculateNextPeriodDateRange(
          currentBudget.period,
          currentBudget.startDate.toDate(),
          currentBudget.endDate.toDate()
        );
        
        // Create the new budget for the next period
        const newBudgetData: Omit<Budget, 'id'> = {
          userId: currentBudget.userId,
          categoryId: currentBudget.categoryId,
          limitAmount: currentBudget.limitAmount, // Keep the same limit
          spentAmount: 0, // Reset spent amount
          period: currentBudget.period,
          startDate: Timestamp.fromDate(startDate),
          endDate: Timestamp.fromDate(endDate),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          isActive: true,
          previousPeriodIds: currentBudget.previousPeriodIds 
            ? [...currentBudget.previousPeriodIds, currentBudget.id] 
            : [currentBudget.id],
        };
        
        // Add the new budget document
        const newBudgetRef = await addDoc(collection(db, 'budgets'), newBudgetData);
        
        // Update the current budget to reference the next period
        batch.update(budgetRef, { 
          isActive: false,
          nextPeriodId: newBudgetRef.id,
          updatedAt: serverTimestamp()
        });
        
        // Add the history record
        await addDoc(collection(db, 'budgetHistory'), historyData);
        
        // Commit the batch
        await batch.commit();
        
        return newBudgetRef.id;
      } catch (error) {
        console.error('Error creating next budget period:', error);
        return null;
      }
    } else {
      // For custom periods, just archive the current budget
      batch.update(budgetRef, { 
        isActive: false,
        updatedAt: serverTimestamp()
      });
      
      // Add the history record
      await addDoc(collection(db, 'budgetHistory'), historyData);
      
      // Commit the batch
      await batch.commit();
      
      return null; // No new budget created for custom periods
    }
  } catch (error) {
    console.error('Error archiving budget:', error);
    return null;
  }
};

/**
 * Check for budgets that have ended and archive them, creating new ones for the next period
 * @param userId The user ID
 * @returns An array of newly created budget IDs
 */
export const checkAndUpdateExpiredBudgets = async (userId: string): Promise<string[]> => {
  try {
    // Get all active budgets for the user that have ended
    const now = new Date();
    const budgetsRef = collection(db, 'budgets');
    const q = query(
      budgetsRef,
      where('userId', '==', userId),
      where('isActive', '==', true)
    );
    
    const budgetsSnapshot = await getDocs(q);
    const expiredBudgets: Budget[] = [];
    
    budgetsSnapshot.forEach(doc => {
      const budget = { id: doc.id, ...doc.data() } as Budget;
      if (hasBudgetPeriodEnded(budget)) {
        expiredBudgets.push(budget);
      }
    });
    
    // Archive each expired budget and create new ones
    const newBudgetIds: string[] = [];
    
    for (const budget of expiredBudgets) {
      const newBudgetId = await archiveBudgetAndCreateNext(budget.id!, userId);
      if (newBudgetId) {
        newBudgetIds.push(newBudgetId);
      }
    }
    
    return newBudgetIds;
  } catch (error) {
    console.error('Error checking for expired budgets:', error);
    return [];
  }
};

/**
 * Get all expenses for a specific budget period
 * @param budgetId The budget ID
 * @param userId The user ID
 * @returns An array of expenses for the budget period
 */
export const getExpensesForBudget = async (budgetId: string, userId: string): Promise<Expense[]> => {
  try {
    // Get the budget to determine the date range
    const budgetRef = doc(db, 'budgets', budgetId);
    const budgetSnap = await getDoc(budgetRef);
    
    if (!budgetSnap.exists()) {
      console.error('Budget not found');
      return [];
    }
    
    const budget = budgetSnap.data() as Budget;
    
    // Query expenses within the budget's date range and category
    const expensesRef = collection(db, 'expenses');
    const q = query(
      expensesRef,
      where('userId', '==', userId),
      where('categoryId', '==', budget.categoryId),
      where('date', '>=', budget.startDate),
      where('date', '<=', budget.endDate)
    );
    
    const expensesSnapshot = await getDocs(q);
    const expenses: Expense[] = [];
    
    expensesSnapshot.forEach(doc => {
      expenses.push({ id: doc.id, ...doc.data() } as Expense);
    });
    
    return expenses;
  } catch (error) {
    console.error('Error getting expenses for budget:', error);
    return [];
  }
};

/**
 * Get budget history for a specific budget
 * @param budgetId The budget ID
 * @param userId The user ID
 * @returns An array of budget history records
 */
export const getBudgetHistory = async (budgetId: string, userId: string): Promise<BudgetHistory[]> => {
  try {
    // Get the current budget
    const budgetRef = doc(db, 'budgets', budgetId);
    const budgetSnap = await getDoc(budgetRef);
    
    if (!budgetSnap.exists()) {
      console.error('Budget not found');
      return [];
    }
    
    const budget = { id: budgetSnap.id, ...budgetSnap.data() } as Budget;
    
    // If the budget has no previous periods, return an empty array
    if (!budget.previousPeriodIds || budget.previousPeriodIds.length === 0) {
      return [];
    }
    
    // Get all history records for the previous periods
    const historyRef = collection(db, 'budgetHistory');
    const q = query(
      historyRef,
      where('userId', '==', userId),
      where('budgetId', 'in', budget.previousPeriodIds)
    );
    
    const historySnapshot = await getDocs(q);
    const history: BudgetHistory[] = [];
    
    historySnapshot.forEach(doc => {
      history.push({ id: doc.id, ...doc.data() } as BudgetHistory);
    });
    
    // Sort by date (newest first)
    history.sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis());
    
    return history;
  } catch (error) {
    console.error('Error getting budget history:', error);
    return [];
  }
};

/**
 * Check if a budget overlaps with existing budgets
 * @param userId The user ID
 * @param categoryId The category ID
 * @param startDate The start date of the budget
 * @param endDate The end date of the budget
 * @param excludeBudgetId Optional budget ID to exclude from the check (for updates)
 * @returns An array of overlapping budgets
 */
export const checkBudgetOverlap = async (
  userId: string,
  categoryId: string,
  startDate: Date,
  endDate: Date,
  excludeBudgetId?: string
): Promise<Budget[]> => {
  try {
    // Query for budgets with the same category
    const budgetsRef = collection(db, 'budgets');
    const q = query(
      budgetsRef,
      where('userId', '==', userId),
      where('categoryId', '==', categoryId),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    const overlappingBudgets: Budget[] = [];
    
    // Convert input dates to timestamps for comparison
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();
    
    querySnapshot.forEach((doc) => {
      // Skip the budget being updated
      if (excludeBudgetId && doc.id === excludeBudgetId) return;
      
      const existingBudget = { id: doc.id, ...doc.data() } as Budget;
      const existingStart = existingBudget.startDate.toDate().getTime();
      const existingEnd = existingBudget.endDate.toDate().getTime();

      // Check if date ranges overlap
      if (startTimestamp <= existingEnd && endTimestamp >= existingStart) {
        overlappingBudgets.push(existingBudget);
      }
    });
    
    return overlappingBudgets;
  } catch (error) {
    console.error('Error checking budget overlap:', error);
    return [];
  }
};