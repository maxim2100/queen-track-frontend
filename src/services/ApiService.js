/* eslint-disable no-console */
import { LOG_PREFIXES } from '../constants';

/**
 * Centralized API service for making requests to the backend
 */
class ApiService {
  constructor() {
    this.backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
    console.log(`${LOG_PREFIXES.INFO} API Service initialized with URL: ${this.backendUrl}`);
  }

  /**
   * Build a complete API URL
   * @param {string} endpoint - API endpoint path
   * @returns {string} Full URL
   */
  buildUrl(endpoint) {
    // Support both string endpoints and function endpoints (used for parameterized routes)
    if (typeof endpoint === 'function') {
      endpoint = endpoint(); // Execute the function to get the actual endpoint
    }
    
    // Remove any leading slashes from endpoint to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    
    return `${this.backendUrl}/${cleanEndpoint}`;
  }

  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Additional fetch options
   * @returns {Promise<any>} Response data
   */
  async get(endpoint, options = {}) {
    try {
      const url = this.buildUrl(endpoint);
      console.log(`${LOG_PREFIXES.API} GET request to: ${url} (endpoint: ${endpoint})`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} GET request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Make a POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body data
   * @param {Object} options - Additional fetch options
   * @returns {Promise<any>} Response data
   */
  async post(endpoint, data = {}, options = {}) {
    try {
      const url = this.buildUrl(endpoint);
      console.log(`${LOG_PREFIXES.API} POST request to: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: JSON.stringify(data),
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} POST request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Make a PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body data
   * @param {Object} options - Additional fetch options
   * @returns {Promise<any>} Response data
   */
  async put(endpoint, data = {}, options = {}) {
    try {
      const url = this.buildUrl(endpoint);
      console.log(`${LOG_PREFIXES.API} PUT request to: ${url}`);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: JSON.stringify(data),
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} PUT request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Make a DELETE request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Additional fetch options
   * @returns {Promise<any>} Response data
   */
  async delete(endpoint, options = {}) {
    try {
      const url = this.buildUrl(endpoint);
      console.log(`${LOG_PREFIXES.API} DELETE request to: ${url}`);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} DELETE request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Upload file with multipart/form-data
   * @param {string} endpoint - API endpoint
   * @param {FormData} formData - Form data with files
   * @param {Object} options - Additional fetch options
   * @returns {Promise<any>} Response data
   */
  async upload(endpoint, formData, options = {}) {
    try {
      const url = this.buildUrl(endpoint);
      console.log(`${LOG_PREFIXES.API} UPLOAD request to: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} UPLOAD request failed for ${endpoint}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
const apiService = new ApiService();
export default apiService; 