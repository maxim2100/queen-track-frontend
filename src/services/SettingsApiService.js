import apiService from './ApiService';
import { API_ENDPOINTS } from '../constants';

/**
 * Service for managing settings API calls
 */
class SettingsApiService {
  /**
   * Get current settings
   * @returns {Promise<Object>} Settings data
   */
  async getSettings() {
    return apiService.get(API_ENDPOINTS.SETTINGS);
  }
  
  /**
   * Get available settings presets
   * @returns {Promise<Object>} Presets data
   */
  async getPresets() {
    return apiService.get(API_ENDPOINTS.SETTINGS_PRESETS);
  }
  
  /**
   * Update settings
   * @param {Object} settings - New settings data
   * @returns {Promise<Object>} Updated settings
   */
  async updateSettings(settings) {
    return apiService.post(API_ENDPOINTS.SETTINGS, settings);
  }
  
  /**
   * Apply a preset
   * @param {string} presetName - Name of preset to apply
   * @returns {Promise<Object>} Result data
   */
  async applyPreset(presetName) {
    return apiService.post(API_ENDPOINTS.SETTINGS_APPLY_PRESET(presetName));
  }
  
  /**
   * Reset settings to defaults
   * @returns {Promise<Object>} Default settings
   */
  async resetSettings() {
    return apiService.post(API_ENDPOINTS.SETTINGS_RESET);
  }
}

const settingsApiService = new SettingsApiService();
export default settingsApiService; 