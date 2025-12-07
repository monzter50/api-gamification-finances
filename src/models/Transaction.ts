import mongoose, { Schema, Document } from 'mongoose';

/**
 * Transaction Interface
 * Represents a financial transaction (income or expense)
 */
export interface ITransaction extends Document {
  user_id: mongoose.Types.ObjectId;
  account_id: string; // Reference to user's accounts array in User model
  date: Date;
  amount: number;
  vendor: string;
  category: string;
  is_installment: boolean;
  owner: string;
  description?: string;
  type: 'income' | 'expense';
  budget_id?: string; // Reference to Budget
  installment_info?: {
    current_installment: number;
    total_installments: number;
    original_amount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  account_id: {
    type: String,
    required: [true, 'Account ID is required']
  },
  date: {
    type: Date,
    required: [true, 'Transaction date is required'],
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    validate: {
      validator: function(v: number) {
        return v !== 0;
      },
      message: 'Amount cannot be zero'
    }
  },
  vendor: {
    type: String,
    required: [true, 'Vendor is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    index: true
  },
  is_installment: {
    type: Boolean,
    required: true,
    default: false
  },
  owner: {
    type: String,
    required: [true, 'Owner is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: [true, 'Transaction type is required'],
    index: true
  },
  budget_id: {
    type: String,
    ref: 'Budget'
  },
  installment_info: {
    current_installment: {
      type: Number,
      min: 1
    },
    total_installments: {
      type: Number,
      min: 1
    },
    original_amount: {
      type: Number,
      min: 0
    }
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
transactionSchema.index({ user_id: 1, date: -1 });
transactionSchema.index({ user_id: 1, type: 1, date: -1 });
transactionSchema.index({ user_id: 1, category: 1 });
transactionSchema.index({ budget_id: 1 });

// Pre-save validation for installment info
transactionSchema.pre('save', function(next) {
  if (this.is_installment) {
    if (!this.installment_info || !this.installment_info.current_installment ||
        !this.installment_info.total_installments || !this.installment_info.original_amount) {
      return next(new Error('Installment info is required for installment transactions'));
    }

    if (this.installment_info.current_installment > this.installment_info.total_installments) {
      return next(new Error('Current installment cannot exceed total installments'));
    }
  }
  next();
});

// Pre-save hook to auto-link to budget
transactionSchema.pre('save', async function(next) {
  if (!this.budget_id && this.date) {
    const year = this.date.getFullYear();
    const month = this.date.getMonth() + 1; // JavaScript months are 0-indexed
    const budgetId = `budget_${year}_${month.toString().padStart(2, '0')}`;

    // Check if budget exists
    const Budget = mongoose.model('Budget');
    const budget = await Budget.findById(budgetId);

    if (budget && budget.user_id.equals(this.user_id)) {
      this.budget_id = budgetId;
    }
  }
  next();
});

// Static method to find transactions by user
transactionSchema.statics.findByUser = function(userId: mongoose.Types.ObjectId) {
  return this.find({ user_id: userId }).sort({ date: -1 });
};

// Static method to find transactions by user and date range
transactionSchema.statics.findByUserAndDateRange = function(
  userId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
) {
  return this.find({
    user_id: userId,
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: -1 });
};

// Static method to find transactions by user and period (month/year)
transactionSchema.statics.findByUserAndPeriod = function(
  userId: mongoose.Types.ObjectId,
  year: number,
  month: number
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  return this.find({
    user_id: userId,
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: -1 });
};

// Static method to find transactions by budget
transactionSchema.statics.findByBudget = function(budgetId: string) {
  return this.find({ budget_id: budgetId }).sort({ date: -1 });
};

// Static method to get spending by category
transactionSchema.statics.getSpendingByCategory = async function(
  userId: mongoose.Types.ObjectId,
  year: number,
  month: number
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  return this.aggregate([
    {
      $match: {
        user_id: userId,
        type: 'expense',
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);
};

// Instance method to check if transaction is overdue installment
transactionSchema.methods.isOverdueInstallment = function(): boolean {
  if (!this.is_installment || !this.installment_info) return false;

  return this.installment_info.current_installment < this.installment_info.total_installments;
};

// Instance method to get month and year
transactionSchema.methods.getMonthYear = function(): { month: number; year: number } {
  return {
    month: this.date.getMonth() + 1,
    year: this.date.getFullYear()
  };
};

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
