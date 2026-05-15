import { type Request } from 'express';
import { type JWTPayload } from './index';

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'vales';

export interface AccountRequest<T = any> extends Request {
  user?: JWTPayload;
  body: T;
}

export interface CreateAccountBody {
  name: string;
  type: AccountType;
  balance?: number;
  currency?: string;
  isActive?: boolean;
}

export interface UpdateAccountBody {
  name?: string;
  type?: AccountType;
  balance?: number;
  currency?: string;
  isActive?: boolean;
}
