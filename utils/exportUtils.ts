import { Expense, Category } from '../models/types';

/**
 * Export utilities for generating CSV and PDF reports
 */

export interface ExportData {
  expenses: Expense[];
  categories: Category[];
  startDate: Date;
  endDate: Date;
  totalAmount: number;
}

export interface ExportOptions {
  format: 'csv' | 'pdf';
  includeHeaders: boolean;
  dateFormat: 'short' | 'long';
}

/**
 * Generate CSV content from expense data
 */
export const generateCSV = (data: ExportData, options: ExportOptions = { format: 'csv', includeHeaders: true, dateFormat: 'short' }): string => {
  const { expenses, categories } = data;
  
  // Create category lookup map
  const categoryMap = new Map<string, string>();
  categories.forEach(category => {
    if (category.id) {
      categoryMap.set(category.id, category.name);
    }
  });

  let csvContent = '';
  
  // Add headers if requested
  if (options.includeHeaders) {
    csvContent += 'Date,Amount,Category,Description,Receipt\n';
  }
  
  // Add expense data
  expenses.forEach(expense => {
    const date = expense.date.toDate();
    const formattedDate = options.dateFormat === 'long' 
      ? date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      : date.toLocaleDateString('en-US');
    
    const categoryName = categoryMap.get(expense.categoryId) || 'Unknown';
    const description = (expense.description || '').replace(/"/g, '""'); // Escape quotes
    const hasReceipt = expense.receiptImageUrl ? 'Yes' : 'No';
    
    csvContent += `"${formattedDate}","₦${expense.amount.toFixed(2)}","${categoryName}","${description}","${hasReceipt}"\n`;
  });
  
  return csvContent;
};

/**
 * Generate PDF content (as formatted text) from expense data
 */
export const generatePDFContent = (data: ExportData, options: ExportOptions = { format: 'pdf', includeHeaders: true, dateFormat: 'long' }): string => {
  const { expenses, categories, startDate, endDate, totalAmount } = data;
  
  // Create category lookup map
  const categoryMap = new Map<string, string>();
  categories.forEach(category => {
    if (category.id) {
      categoryMap.set(category.id, category.name);
    }
  });

  let content = '';
  
  // Header
  content += 'EXPENSE REPORT\n';
  content += '='.repeat(50) + '\n\n';
  
  // Report period
  const startDateStr = startDate.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const endDateStr = endDate.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  content += `Report Period: ${startDateStr} to ${endDateStr}\n`;
  content += `Total Expenses: ₦${totalAmount.toFixed(2)}\n`;
  content += `Number of Transactions: ${expenses.length}\n\n`;
  
  // Summary by category
  const categoryTotals = new Map<string, number>();
  expenses.forEach(expense => {
    const categoryName = categoryMap.get(expense.categoryId) || 'Unknown';
    const currentTotal = categoryTotals.get(categoryName) || 0;
    categoryTotals.set(categoryName, currentTotal + expense.amount);
  });
  
  content += 'SUMMARY BY CATEGORY\n';
  content += '-'.repeat(30) + '\n';
  
  Array.from(categoryTotals.entries())
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1]) // Sort by amount descending
    .forEach(([categoryName, total]: [string, number]) => {
      const percentage = totalAmount > 0 ? ((total / totalAmount) * 100).toFixed(1) : '0.0';
      content += `${categoryName.padEnd(20)} ₦${total.toFixed(2).padStart(10)} (${percentage}%)\n`;
    });
  
  content += '\n';
  
  // Detailed transactions
  content += 'DETAILED TRANSACTIONS\n';
  content += '-'.repeat(30) + '\n\n';
  
  expenses.forEach((expense, index) => {
    const date = expense.date.toDate();
    const formattedDate = options.dateFormat === 'long'
      ? date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      : date.toLocaleDateString('en-US');
    
    const categoryName = categoryMap.get(expense.categoryId) || 'Unknown';
    
    content += `${index + 1}. ${formattedDate}\n`;
    content += `   Amount: ₦${expense.amount.toFixed(2)}\n`;
    content += `   Category: ${categoryName}\n`;
    if (expense.description) {
      content += `   Description: ${expense.description}\n`;
    }
    if (expense.receiptImageUrl) {
      content += `   Receipt: Available\n`;
    }
    content += '\n';
  });
  
  // Footer
  content += '\n' + '='.repeat(50) + '\n';
  content += `Generated on: ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}\n`;
  
  return content;
};

/**
 * Get file name for export based on date range and format
 */
export const getExportFileName = (startDate: Date, endDate: Date, format: 'csv' | 'pdf'): string => {
  const startStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const endStr = endDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const extension = format === 'csv' ? 'csv' : 'txt'; // Using .txt for PDF content since we're not generating actual PDF
  
  return `expense-report-${startStr}-to-${endStr}.${extension}`;
};

/**
 * Validate export data
 */
export const validateExportData = (data: ExportData): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!data.expenses || data.expenses.length === 0) {
    errors.push('No expenses found for the selected date range');
  }
  
  if (!data.categories || data.categories.length === 0) {
    errors.push('No categories available');
  }
  
  if (!data.startDate || !data.endDate) {
    errors.push('Invalid date range');
  }
  
  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    errors.push('Start date must be before end date');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
