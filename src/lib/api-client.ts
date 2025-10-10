/**
 * API Client utility for making HTTP requests with proper URL handling
 * Ensures all API calls use absolute URLs compatible with Vercel deployment
 */

import { getApiUrl, getBaseUrl } from './url-utils';

/**
 * API Client class for making HTTP requests
 */
export class ApiClient {
  private baseUrl: string;

  constructor() {
    // Use the application base URL (without the trailing `/api`) so
    // buildUrl can consistently add or respect the `api/` segment.
    this.baseUrl = getBaseUrl();
  }

  /**
   * Make a GET request
   */
  async get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = this.buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'GET',
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Make a POST request
   */
  async post<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    const url = this.buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Make a PUT request
   */
  async put<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    const url = this.buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Make a PATCH request
   */
  async patch<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    const url = this.buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Make a DELETE request
   */
  async delete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = this.buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'DELETE',
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Build absolute URL from endpoint
   */
  private buildUrl(endpoint: string): string {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

    // If the caller already included an `api/` segment, respect it.
    if (cleanEndpoint.startsWith('api/')) {
      return `${this.baseUrl}/${cleanEndpoint}`;
    }

    // Otherwise, add the `api/` segment
    return `${this.baseUrl}/api/${cleanEndpoint}`;
  }
}

// Create a singleton instance
export const apiClient = new ApiClient();

/**
 * Convenience functions for common API operations
 */
export const api = {
  /**
   * Get data from an API endpoint
   */
  get: <T = any>(endpoint: string, options?: RequestInit) => 
    apiClient.get<T>(endpoint, options),

  /**
   * Post data to an API endpoint
   */
  post: <T = any>(endpoint: string, data?: any, options?: RequestInit) => 
    apiClient.post<T>(endpoint, data, options),

  /**
   * Update data at an API endpoint
   */
  put: <T = any>(endpoint: string, data?: any, options?: RequestInit) => 
    apiClient.put<T>(endpoint, data, options),

  /**
   * Partially update data at an API endpoint
   */
  patch: <T = any>(endpoint: string, data?: any, options?: RequestInit) => 
    apiClient.patch<T>(endpoint, data, options),

  /**
   * Delete data from an API endpoint
   */
  delete: <T = any>(endpoint: string, options?: RequestInit) => 
    apiClient.delete<T>(endpoint, options),
};

/**
 * Legacy fetch wrapper for backward compatibility
 * Use this to replace existing fetch('/api/...') calls
 */
export const apiFetch = async (endpoint: string, options?: RequestInit): Promise<Response> => {
  // If caller passed an absolute URL, use it directly
  if (endpoint.startsWith('http')) {
    return fetch(endpoint, options);
  }

  // Normalize endpoint to avoid double `/api/api` when callers include `/api/...`
  const cleaned = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

  // If the cleaned endpoint already starts with `api/`, join with base URL directly
  const url = cleaned.startsWith('api/')
    ? `${getBaseUrl()}/${cleaned}`
    : `${getBaseUrl()}/api/${cleaned}`;

  return fetch(url, options);
};
