/**
 * Standard API Response Types
 * All API endpoints should use these consistent response formats
 */

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  timestamp: string;
  code?: string | number;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create a standard success response
 */
export function createSuccessResponse<T>(data: T, message?: string): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    ...(message && { message })
  };
}

/**
 * Create a standard error response
 */
export function createErrorResponse(
  error: string,
  message?: string,
  code?: string | number
): ApiErrorResponse {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString(),
    ...(message && { message }),
    ...(code && { code })
  };
}
