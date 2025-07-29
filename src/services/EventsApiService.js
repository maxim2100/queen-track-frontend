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

  /**
   * Get filtered events with optional parameters
   * @param {Object} params - Filter parameters
   * @param {string} params.start_date - Start date (YYYY-MM-DD)
   * @param {string} params.end_date - End date (YYYY-MM-DD)
   * @param {string} params.event_type - Event type (exit/entrance/both)
   * @param {number} params.limit - Number of events to return
   * @param {number} params.skip - Number of events to skip
   * @param {string} params.sort_by - Sort field (time_out/time_in)
   * @param {string} params.sort_order - Sort order (asc/desc)
   * @returns {Promise<Array>} Filtered events data
   */
  async getFilteredEvents(params = {}) {
    const queryString = new URLSearchParams();
    
    // Build query parameters
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        queryString.append(key, params[key]);
      }
    });
    
    const url = queryString.toString() 
      ? `${API_ENDPOINTS.EVENTS}?${queryString.toString()}`
      : API_ENDPOINTS.EVENTS;
    
    return apiService.get(url);
  }

  /**
   * Get event statistics
   * @param {Object} params - Filter parameters for statistics
   * @param {string} params.start_date - Start date (YYYY-MM-DD)
   * @param {string} params.end_date - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Statistics data
   */
  async getEventStatistics(params = {}) {
    const queryString = new URLSearchParams();
    
    // Build query parameters
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        queryString.append(key, params[key]);
      }
    });
    
    const url = queryString.toString() 
      ? `${API_ENDPOINTS.EVENTS}/statistics/summary?${queryString.toString()}`
      : `${API_ENDPOINTS.EVENTS}/statistics/summary`;
    
    return apiService.get(url);
  }

  /**
   * Get recent events (for dashboard)
   * @param {number} limit - Number of recent events to fetch
   * @returns {Promise<Array>} Recent events data
   */
  async getRecentEvents(limit = 10) {
    return apiService.get(`${API_ENDPOINTS.EVENTS}/recent?limit=${limit}`);
  }

  /**
   * Get today's events
   * @returns {Promise<Array>} Today's events data
   */
  async getTodayEvents() {
    return apiService.get(`${API_ENDPOINTS.EVENTS}/today`);
  }
}

const eventsApiService = new EventsApiService();
export default eventsApiService; 