/* eslint-disable no-console */
import StreamService from './StreamService';
import CameraService from './CameraService';
import ApiService from './ApiService';
import EventsApiService from './EventsApiService';
import UploadApiService from './UploadApiService';
import SettingsApiService from './SettingsApiService';
import SystemApiService from './SystemApiService';
import NotificationService from './NotificationService';
import { LOG_PREFIXES } from '../constants';

/**
 * Unified service manager for handling all application services
 * Provides centralized initialization, error handling, and lifecycle management
 */
class ServiceManager {
  constructor() {
    this.services = new Map();
    this.listeners = new Map();
    this.isInitialized = false;
    
    // Register core services
    this.services.set('notification', NotificationService);
    this.services.set('stream', StreamService);
    this.services.set('camera', CameraService);
    
    // Register API services
    this.services.set('api', ApiService);
    this.services.set('eventsApi', EventsApiService);
    this.services.set('uploadApi', UploadApiService);
    this.services.set('settingsApi', SettingsApiService);
    this.services.set('systemApi', SystemApiService);
  }

  /**
   * Initialize all services
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn(`${LOG_PREFIXES.WARNING} ServiceManager already initialized`);
      return true;
    }

    console.log(`${LOG_PREFIXES.INFO} Initializing ServiceManager...`);
    
    try {
      // Initialize services in order
      const initResults = await Promise.allSettled([
        this.services.get('notification').initialize(),
        this.services.get('stream').initialize(),
        this.services.get('camera').initialize()
      ]);

      // Check results
      const failures = initResults
        .map((result, index) => ({ result, service: Array.from(this.services.keys())[index] }))
        .filter(({ result }) => result.status === 'rejected' || result.value === false);

      if (failures.length > 0) {
        console.error(`${LOG_PREFIXES.ERROR} Failed to initialize services:`, failures);
        this.emitEvent('initializationError', { failures });
        return false;
      }

      this.isInitialized = true;
      console.log(`${LOG_PREFIXES.SUCCESS} All services initialized successfully`);
      this.emitEvent('initialized');
      return true;
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Error during service initialization:`, error);
      this.emitEvent('initializationError', { error });
      return false;
    }
  }

  /**
   * Destroy all services and cleanup
   */
  destroy() {
    console.log(`${LOG_PREFIXES.INFO} Destroying ServiceManager...`);
    
    try {
      // Destroy services in reverse order
      Array.from(this.services.values()).reverse().forEach(service => {
        try {
          service.destroy();
        } catch (error) {
          console.error(`${LOG_PREFIXES.ERROR} Error destroying service:`, error);
        }
      });

      this.isInitialized = false;
      this.listeners.clear();
      
      console.log(`${LOG_PREFIXES.SUCCESS} ServiceManager destroyed successfully`);
      this.emitEvent('destroyed');
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Error during service destruction:`, error);
    }
  }

  /**
   * Get a specific service
   * @param {string} serviceName - Name of the service
   * @returns {Object|null} Service instance
   */
  getService(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      console.error(`${LOG_PREFIXES.ERROR} Service not found:`, serviceName);
      return null;
    }
    return service;
  }

  /**
   * Get notification service
   * @returns {NotificationService} Notification service instance
   */
  getNotificationService() {
    return this.getService('notification');
  }

  /**
   * Get stream service
   * @returns {StreamService} Stream service instance
   */
  getStreamService() {
    return this.getService('stream');
  }

  /**
   * Get camera service
   * @returns {CameraService} Camera service instance
   */
  getCameraService() {
    return this.getService('camera');
  }

  /**
   * Check if all services are ready
   * @returns {boolean} Ready status
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Get health status of all services
   * @returns {Object} Health status information
   */
  getHealthStatus() {
    const status = {
      overall: this.isInitialized ? 'healthy' : 'unhealthy',
      services: {}
    };

    this.services.forEach((service, name) => {
      try {
        switch (name) {
          case 'notification':
            status.services[name] = {
              connectionStatus: service.getConnectionStatus(),
              notificationCount: service.getNotifications().notifications.length
            };
            break;
          case 'stream':
            status.services[name] = {
              connectionStatus: service.getConnectionStatus(),
              streamingState: service.getStreamingState()
            };
            break;
          case 'camera':
            status.services[name] = {
              deviceCount: service.getCameraState().devices.length,
              externalCameraStatus: service.getCameraState().externalCameraStatus
            };
            break;
          default:
            status.services[name] = { status: 'unknown' };
        }
      } catch (error) {
        status.services[name] = { 
          status: 'error', 
          error: error.message 
        };
      }
    });

    return status;
  }

  /**
   * Add global event listener for service manager events
   * @param {string} eventType - Event type
   * @param {function} callback - Callback function
   */
  addEventListener(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
  }

  /**
   * Remove global event listener
   * @param {string} eventType - Event type
   * @param {function} callback - Callback function
   */
  removeEventListener(eventType, callback) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(callback);
      
      if (this.listeners.get(eventType).size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  /**
   * Emit event to all registered listeners
   * @param {string} eventType - Event type
   * @param {*} data - Event data
   */
  emitEvent(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`${LOG_PREFIXES.ERROR} Error in ServiceManager event listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Handle global errors from services
   * @param {Error} error - Error object
   * @param {string} serviceName - Name of the service that generated the error
   * @param {Object} context - Additional context
   */
  handleServiceError(error, serviceName, context = {}) {
    const errorInfo = {
      error,
      serviceName,
      context,
      timestamp: new Date().toISOString(),
      healthStatus: this.getHealthStatus()
    };

    console.error(`${LOG_PREFIXES.ERROR} Service error in ${serviceName}:`, errorInfo);
    this.emitEvent('serviceError', errorInfo);
  }
}

// Export singleton instance
const serviceManager = new ServiceManager();
export default serviceManager;