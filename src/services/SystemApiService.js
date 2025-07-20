import apiService from './ApiService';
import { API_ENDPOINTS } from '../constants';

/**
 * Service for managing system/health API calls
 */
class SystemApiService {
  /**
   * Get system health status
   * @returns {Promise<Object>} Health status data
   */
  async getHealth() {
    return apiService.get(API_ENDPOINTS.HEALTH);
  }
  
  /**
   * Get system diagnostics
   * @returns {Promise<Object>} Diagnostics data
   */
  async getDiagnostics() {
    return apiService.get(API_ENDPOINTS.DIAGNOSTICS);
  }
}

const systemApiService = new SystemApiService();
export default systemApiService; 