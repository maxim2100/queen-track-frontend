import apiService from './ApiService';
import { API_ENDPOINTS } from '../constants';

/**
 * Service for managing file uploads
 */
class UploadApiService {
  /**
   * Upload a file
   * @param {FormData} formData - Form data with file
   * @returns {Promise<Object>} Upload response
   */
  async uploadFile(formData) {
    return apiService.upload(API_ENDPOINTS.UPLOAD, formData);
  }
}

const uploadApiService = new UploadApiService();
export default uploadApiService; 