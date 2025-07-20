import apiService from './ApiService';
import { API_ENDPOINTS } from '../constants';

/**
 * Service for managing Events API calls
 */
class EventsApiService {
  /**
   * Get all events
   * @returns {Promise<Object>} Events data
   */
  async getAllEvents() {
    return apiService.get(API_ENDPOINTS.EVENTS);
  }
  
  /**
   * Get a specific event by ID
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} Event data
   */
  async getEvent(eventId) {
    return apiService.get(API_ENDPOINTS.EVENT_BY_ID(eventId));
  }
  
  /**
   * Delete event by ID
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} Response data
   */
  async deleteEvent(eventId) {
    return apiService.delete(API_ENDPOINTS.EVENT_BY_ID(eventId));
  }
}

const eventsApiService = new EventsApiService();
export default eventsApiService; 