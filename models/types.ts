import { Timestamp } from 'firebase/firestore';

// Represents the structure of a User document in Firestore (from AuthContext)
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  createdAt?: Timestamp; // Or Date, depending on how you store it. Made optional for flexibility.
}

// Represents an Expense document in the 'expenses' collection
export interface Expense {
  id?: string; // Optional: document ID, often added client-side after fetching
  userId: string;
  amount: number;
  categoryId: string;
  date: Timestamp; // Date the expense occurred
  description?: string;
  receiptImageUrl?: string;
  createdAt: Timestamp; // When the document was created
  updatedAt: Timestamp; // When the document was last updated
  isRecurring?: boolean; // Whether this expense recurs regularly
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'; // Frequency of recurring expense
  parentExpenseId?: string; // Reference to the original expense (for recurring instances)
  childExpenseIds?: string[]; // References to recurring instances of this expense
}

// Represents a Category document in the 'categories' collection
export interface Category {
  id?: string; // Optional: document ID
  name: string;
  icon?: string; // e.g., name of an Ionicons icon
  isDefault?: boolean;
  userId?: string; // For user-created categories
  color?: string; // Color for category visualization
}

// Represents a Budget document in the 'budgets' collection
export interface Budget {
  id?: string; // Optional: document ID
  userId: string;
  categoryId: string;
  limitAmount: number;
  spentAmount: number;
  period: 'monthly' | 'weekly' | 'yearly' | 'custom'; // Budget period
  startDate: Timestamp;
  endDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive?: boolean; // Whether this budget is currently active
  previousPeriodIds?: string[]; // References to previous periods of this budget
  nextPeriodId?: string; // Reference to the next period of this budget (if this is completed)
}

// Represents a historical budget record in the 'budgetHistory' collection
export interface BudgetHistory {
  id?: string; // Optional: document ID
  budgetId: string; // Reference to the original budget
  userId: string;
  categoryId: string;
  limitAmount: number;
  spentAmount: number;
  period: 'monthly' | 'weekly' | 'yearly' | 'custom';
  startDate: Timestamp;
  endDate: Timestamp;
  createdAt: Timestamp;
  completedAt: Timestamp; // When this budget period was completed/archived
}

// Represents an expense summary for a time period
export interface ExpenseSummary {
  id?: string; // Optional: document ID
  userId: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: Timestamp;
  endDate: Timestamp;
  totalAmount: number;
  categoryBreakdown: Record<string, number>; // Map of categoryId to amount
  createdAt: Timestamp;
}

// You might also want a type for combined data, e.g., an expense with its category details
export interface ExpenseWithCategory extends Expense {
  category?: Category; // Populated after fetching and joining
}

// Represents a budget with its category details
export interface BudgetWithCategory extends Budget {
  category?: Category; // Populated after fetching and joining
}

// Represents a budget with its history
export interface BudgetWithHistory extends Budget {
  history?: BudgetHistory[]; // Array of historical budget periods
}

// Represents an expense with its recurring instances
export interface ExpenseWithRecurring extends Expense {
  recurringInstances?: Expense[]; // Array of recurring expense instances
}

// Represents expense trend data for visualization
export interface ExpenseTrend {
  date: Date;
  totalAmount: number;
  categoryId?: string; // Optional: for category-specific trends
}

// Represents a comparison between two expense periods
export interface ExpensePeriodComparison {
  currentPeriod: {
    startDate: Date;
    endDate: Date;
    totalAmount: number;
  };
  previousPeriod: {
    startDate: Date;
    endDate: Date;
    totalAmount: number;
  };
  percentageChange: number;
  categoryComparisons?: Record<string, {
    currentAmount: number;
    previousAmount: number;
    percentageChange: number;
  }>;
}
