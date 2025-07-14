import { Response } from 'express';
import type { ApiResponse } from '@/types/index.js';

/**
 * Utility functions for standardized API responses
 */

/**
 * Success response
 * @param res - Express response object
 * @param statusCode - HTTP status code
 * @param message - Success message
 * @param data - Response data
 */
export const successResponse = <T>(
  res: Response,
  statusCode: number = 200,
  message: string = 'Success',
  data?: T
): Response<ApiResponse<T>> => {
  const response: ApiResponse<T> = {
    success: true,
    message
  };

  if (data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Error response
 * @param res - Express response object
 * @param statusCode - HTTP status code
 * @param message - Error message
 * @param error - Error details
 */
export const errorResponse = (
  res: Response,
  statusCode: number = 500,
  message: string = 'Internal Server Error',
  error?: any
): Response<ApiResponse> => {
  const response: ApiResponse = {
    success: false,
    message
  };

  if (error && process.env.NODE_ENV === 'development') {
    response.error = error;
  }

  return res.status(statusCode).json(response);
};

/**
 * Validation error response
 * @param res - Express response object
 * @param errors - Validation errors array
 */
export const validationErrorResponse = (
  res: Response,
  errors: any[]
): Response<ApiResponse> => {
  return res.status(400).json({
    success: false,
    message: 'Validation Error',
    errors
  });
};

/**
 * Not found response
 * @param res - Express response object
 * @param message - Not found message
 */
export const notFoundResponse = (
  res: Response,
  message: string = 'Resource not found'
): Response<ApiResponse> => {
  return res.status(404).json({
    success: false,
    message
  });
};

/**
 * Unauthorized response
 * @param res - Express response object
 * @param message - Unauthorized message
 */
export const unauthorizedResponse = (
  res: Response,
  message: string = 'Unauthorized'
): Response<ApiResponse> => {
  return res.status(401).json({
    success: false,
    message
  });
};

/**
 * Forbidden response
 * @param res - Express response object
 * @param message - Forbidden message
 */
export const forbiddenResponse = (
  res: Response,
  message: string = 'Forbidden'
): Response<ApiResponse> => {
  return res.status(403).json({
    success: false,
    message
  });
}; 