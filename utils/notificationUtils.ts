import { Budget, Category } from '../models/types';

/**
 * Utility functions for handling budget notifications
 */

// Threshold percentages for different notification levels
export const BUDGET_WARNING_THRESHOLD = 80; // 80% of budget used
export const BUDGET_HIGH_WARNING_THRESHOLD = 90; // 90% of budget used
export const BUDGET_DANGER_THRESHOLD = 95; // 95% of budget used
export const BUDGET_EXCEEDED_THRESHOLD = 100; // Budget exceeded

/**
 * Check if a budget is approaching or has exceeded its limit
 * @param budget The budget to check
 * @returns An object with notification status and message
 */
export const checkBudgetStatus = (budget: Budget, categoryName: string): {
  status: 'normal' | 'warning' | 'high-warning' | 'danger' | 'exceeded';
  message: string;
  percentage: number;
} => {
  // Calculate the percentage of budget used
  const percentage = budget.limitAmount > 0
    ? (budget.spentAmount / budget.limitAmount) * 100
    : 0;

  // Determine the status based on the percentage
  if (percentage >= BUDGET_EXCEEDED_THRESHOLD) {
    return {
      status: 'exceeded',
      message: `Your ${categoryName} budget has been exceeded! You've spent ${percentage.toFixed(1)}% of your budget.`,
      percentage
    };
  } else if (percentage >= BUDGET_DANGER_THRESHOLD) {
    return {
      status: 'danger',
      message: `Your ${categoryName} budget is almost depleted! You've used ${percentage.toFixed(1)}% of your budget.`,
      percentage
    };
  } else if (percentage >= BUDGET_HIGH_WARNING_THRESHOLD) {
    return {
      status: 'high-warning',
      message: `Your ${categoryName} budget is running low. You've used ${percentage.toFixed(1)}% of your budget.`,
      percentage
    };
  } else if (percentage >= BUDGET_WARNING_THRESHOLD) {
    return {
      status: 'warning',
      message: `You're approaching your ${categoryName} budget limit. You've used ${percentage.toFixed(1)}% of your budget.`,
      percentage
    };
  } else {
    return {
      status: 'normal',
      message: `Your ${categoryName} budget is on track. You've used ${percentage.toFixed(1)}% of your budget.`,
      percentage
    };
  }
};

/**
 * Get all budget notifications for a user
 * @param budgets List of user budgets
 * @param categories List of categories
 * @returns Array of notification objects
 */
export const getBudgetNotifications = (
  budgets: Budget[],
  categories: Category[]
): Array<{
  id: string;
  categoryId: string;
  categoryName: string;
  status: 'normal' | 'warning' | 'high-warning' | 'danger' | 'exceeded';
  message: string;
  percentage: number;
  timestamp: Date;
}> => {
  const notifications = [];

  // Check each budget and create notifications for those approaching or exceeding limits
  for (const budget of budgets) {
    const category = categories.find(c => c.id === budget.categoryId);
    const categoryName = category?.name || 'Uncategorized';

    const { status, message, percentage } = checkBudgetStatus(budget, categoryName);

    // Only create notifications for warning, high-warning, danger, or exceeded statuses
    if (status !== 'normal') {
      notifications.push({
        id: budget.id,
        categoryId: budget.categoryId,
        categoryName,
        status,
        message,
        percentage,
        timestamp: new Date()
      });
    }
  }

  return notifications;
};
