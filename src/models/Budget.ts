import mongoose, { Schema, Document } from 'mongoose';

/**
 * Income Type Enum
 */
export type IncomeType = 'Debit Card' | 'Credit Card' | 'Cash' | 'Vales' | 'Transfer' | 'Check' | 'Other';

export const INCOME_TYPES: IncomeType[] = ['Debit Card', 'Credit Card', 'Cash', 'Vales', 'Transfer', 'Check', 'Other'];

/**
 * Income Item Interface
 */
export interface IIncomeItem {
  _id?: mongoose.Types.ObjectId;
  description: string;
  amount: number;
  type: IncomeType;
}

/**
 * Expense Item Interface
 */
export interface IExpenseItem {
  _id?: mongoose.Types.ObjectId;
  description: string;
  amount: number;
}

/**
 * Budget Interface
 * Represents a monthly budget for a user
 */
export interface IBudget extends Document {
  userId: mongoose.Types.ObjectId;
  year: number;
  month: number; // 0-11 (January = 0, December = 11)
  incomeItems: IIncomeItem[];
  expenseItems: IExpenseItem[];
  createdAt: Date;
  updatedAt: Date;
  // Virtual properties
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRate: number;
}

const incomeItemSchema = new Schema<IIncomeItem>({
  description: {
    type: String,
    required: [true, 'Income description is required'],
    trim: true,
    minlength: [1, 'Description must not be empty']
  },
  amount: {
    type: Number,
    required: [true, 'Income amount is required'],
    min: [0, 'Amount must be positive']
  },
  type: {
    type: String,
    required: [true, 'Income type is required'],
    enum: {
      values: INCOME_TYPES,
      message: 'Invalid income type. Must be one of: Debit Card, Credit Card, Cash, Vales, Transfer, Check, Other'
    },
    default: 'Other'
  }
}, { _id: true });

const expenseItemSchema = new Schema<IExpenseItem>({
  description: {
    type: String,
    required: [true, 'Expense description is required'],
    trim: true,
    minlength: [1, 'Description must not be empty']
  },
  amount: {
    type: Number,
    required: [true, 'Expense amount is required'],
    min: [0, 'Amount must be positive']
  }
}, { _id: true });

const budgetSchema = new Schema<IBudget>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [2000, 'Year must be 2000 or later'],
    max: [2100, 'Year must be 2100 or earlier']
  },
  month: {
    type: Number,
    required: [true, 'Month is required'],
    min: [0, 'Month must be between 0 and 11'],
    max: [11, 'Month must be between 0 and 11']
  },
  incomeItems: {
    type: [incomeItemSchema],
    default: []
  },
  expenseItems: {
    type: [expenseItemSchema],
    default: []
  }
}, {
  timestamps: true
});

// Unique compound index to prevent duplicate budgets for same user/year/month
budgetSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

// Additional indexes for efficient querying
budgetSchema.index({ userId: 1, year: -1, month: -1 });

// Virtual: Total Income
budgetSchema.virtual('totalIncome').get(function() {
  return this.incomeItems.reduce((sum, item) => sum + item.amount, 0);
});

// Virtual: Total Expense
budgetSchema.virtual('totalExpense').get(function() {
  return this.expenseItems.reduce((sum, item) => sum + item.amount, 0);
});

// Virtual: Net Savings
budgetSchema.virtual('netSavings').get(function() {
  return this.totalIncome - this.totalExpense;
});

// Virtual: Savings Rate (%)
budgetSchema.virtual('savingsRate').get(function() {
  if (this.totalIncome === 0) return 0;
  return (this.netSavings / this.totalIncome) * 100;
});

// Ensure virtuals are included in JSON responses
budgetSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    // Remove internal fields
    const { __v, ...rest } = ret;
    return rest;
  }
});

budgetSchema.set('toObject', { virtuals: true });

// Static method to find budget by user and period
budgetSchema.statics.findByUserAndPeriod = function(
  userId: mongoose.Types.ObjectId,
  year: number,
  month: number
) {
  return this.findOne({ userId, year, month });
};

// Static method to find all budgets for a user
budgetSchema.statics.findByUser = function(
  userId: mongoose.Types.ObjectId,
  filters?: { year?: number; month?: number }
) {
  const query: any = { userId };

  if (filters?.year !== undefined) {
    query.year = filters.year;
  }

  if (filters?.month !== undefined) {
    query.month = filters.month;
  }

  return this.find(query).sort({ year: -1, month: -1 });
};

// Instance method to add income item
budgetSchema.methods.addIncomeItem = function(description: string, amount: number, type: IncomeType) {
  this.incomeItems.push({ description, amount, type });
  return this.save();
};

// Instance method to update income item
budgetSchema.methods.updateIncomeItem = function(itemId: string, description: string, amount: number, type: IncomeType) {
  const item = this.incomeItems.id(itemId);
  if (!item) {
    throw new Error('Income item not found');
  }

  item.description = description;
  item.amount = amount;
  item.type = type;
  return this.save();
};

// Instance method to remove income item
budgetSchema.methods.removeIncomeItem = function(itemId: string) {
  const item = this.incomeItems.id(itemId);
  if (!item) {
    throw new Error('Income item not found');
  }

  item.deleteOne();
  return this.save();
};

// Instance method to add expense item
budgetSchema.methods.addExpenseItem = function(description: string, amount: number) {
  this.expenseItems.push({ description, amount });
  return this.save();
};

// Instance method to update expense item
budgetSchema.methods.updateExpenseItem = function(itemId: string, description: string, amount: number) {
  const item = this.expenseItems.id(itemId);
  if (!item) {
    throw new Error('Expense item not found');
  }

  item.description = description;
  item.amount = amount;
  return this.save();
};

// Instance method to remove expense item
budgetSchema.methods.removeExpenseItem = function(itemId: string) {
  const item = this.expenseItems.id(itemId);
  if (!item) {
    throw new Error('Expense item not found');
  }

  item.deleteOne();
  return this.save();
};

// Instance method to get income items by type
budgetSchema.methods.getIncomeByType = function(type: IncomeType) {
  return this.incomeItems.filter((item: IIncomeItem) => item.type === type);
};

// Instance method to calculate totals by income type
budgetSchema.methods.getIncomeTotalsByType = function(): Record<IncomeType, number> {
  const totals: Record<string, number> = {};

  this.incomeItems.forEach((item: IIncomeItem) => {
    totals[item.type] = (totals[item.type] || 0) + item.amount;
  });

  return totals as Record<IncomeType, number>;
};

export const Budget = mongoose.model<IBudget>('Budget', budgetSchema);
