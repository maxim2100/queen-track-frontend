/* eslint-disable no-console */
import {
  WEBSOCKET_URLS,
  API_ENDPOINTS,
  DEFAULT_CONFIG,
  NOTIFICATION_TYPES,
  EXTERNAL_CAMERA_ACTIONS,
  WEBSOCKET_STATE_NAMES,
  LOG_PREFIXES
} from '../constants';

class NotificationService {
  constructor() {
    this.websocket = null;
    this.reconnectTimeout = null;
    this.listeners = new Map();
    this.isConnecting = false;
    this.shouldReconnect = true;
    
    // Configuration
    this.websocketUrl = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8000';
    this.backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
    
    // State
    this.notifications = [];
    this.unreadCount = 0;
    
    // Test mode properties
    this.onExternalCameraTrigger = null;
    this.testMode = false;
    this.testCallbacks = {};
    this.testId = null;
  }

  // Public API Methods

  /**
   * Initialize the notification service and connect to WebSocket
   */
  async initialize() {
    try {
      console.log(`${LOG_PREFIXES.NOTIFICATION} Initializing notification service`);
      await this.loadNotificationsFromDB();
      this.connect();
      return true;
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Failed to initialize notification service:`, error);
      return false;
    }
  }

  /**
   * Disconnect and cleanup the notification service
   */
  destroy() {
    console.log(`${LOG_PREFIXES.NOTIFICATION} Destroying notification service`);
    this.shouldReconnect = false;
    this.clearReconnectTimeout();
    this.disconnect();
    this.listeners.clear();
  }

  /**
   * Connect to the notifications WebSocket
   */
  connect() {
    if (this.isConnecting || (this.websocket && this.websocket.readyState === WebSocket.OPEN)) {
      console.log(`${LOG_PREFIXES.WARNING} Already connecting or connected to notifications WebSocket`);
      return;
    }

    this.isConnecting = true;
    const fullUrl = `${this.websocketUrl}${WEBSOCKET_URLS.NOTIFICATIONS}`;
    
    console.log(`${LOG_PREFIXES.NOTIFICATION} Connecting to:`, fullUrl);
    console.log(`${LOG_PREFIXES.INFO} Environment:`, {
      REACT_APP_WEBSOCKET_URL: process.env.REACT_APP_WEBSOCKET_URL,
      REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL,
      NODE_ENV: process.env.NODE_ENV
    });

    try {
      this.websocket = new WebSocket(fullUrl);
      this.setupWebSocketEventHandlers();
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Failed to create WebSocket:`, error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the notifications WebSocket
   */
  disconnect() {
    if (this.websocket && this.websocket.readyState !== WebSocket.CLOSED) {
      try {
        this.websocket.close(1000, 'Service disconnect');
      } catch (error) {
        console.warn(`${LOG_PREFIXES.WARNING} Error closing WebSocket:`, error);
      }
    }
    this.websocket = null;
    this.isConnecting = false;
  }

  /**
   * Add event listener for specific notification types
   * @param {string} eventType - Type of event to listen for
   * @param {function} callback - Callback function to execute
   */
  addEventListener(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
    
    console.log(`${LOG_PREFIXES.NOTIFICATION} Added listener for event:`, eventType);
  }

  /**
   * Remove event listener
   * @param {string} eventType - Type of event
   * @param {function} callback - Callback function to remove
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
   * Get current connection status
   */
  getConnectionStatus() {
    if (!this.websocket) return 'disconnected';
    return WEBSOCKET_STATE_NAMES[this.websocket.readyState] || 'unknown';
  }

  /**
   * Get current notifications
   */
  getNotifications() {
    return {
      notifications: [...this.notifications],
      unreadCount: this.unreadCount
    };
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    try {
      const response = await fetch(`${this.backendUrl}${API_ENDPOINTS.NOTIFICATIONS_MARK_READ}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        this.notifications = this.notifications.map(n => ({ ...n, read: true }));
        this.unreadCount = 0;
        this.emitEvent('notificationsUpdated', this.getNotifications());
        return true;
      } else {
        console.error(`${LOG_PREFIXES.ERROR} Failed to mark notifications as read`);
        return false;
      }
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Error marking notifications as read:`, error);
      return false;
    }
  }

  /**
   * Delete all notifications
   */
  async deleteAllNotifications() {
    try {
      const response = await fetch(`${this.backendUrl}${API_ENDPOINTS.NOTIFICATIONS}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        this.notifications = [];
        this.unreadCount = 0;
        this.emitEvent('notificationsUpdated', this.getNotifications());
        return true;
      } else {
        console.error(`${LOG_PREFIXES.ERROR} Failed to delete notifications`);
        return false;
      }
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Error deleting notifications:`, error);
      return false;
    }
  }

  /**
   * Enable test mode for monitoring test-specific events
   * @param {string} testId - Test ID to track
   */
  enableTestMode(testId) {
    this.testMode = true;
    this.testId = testId;
    console.log(`${LOG_PREFIXES.NOTIFICATION} Notification service in test mode for test: ${testId}`);
  }

  /**
   * Disable test mode
   */
  disableTestMode() {
    this.testMode = false;
    this.testId = null;
    this.testCallbacks = {};
    console.log(`${LOG_PREFIXES.NOTIFICATION} Test mode disabled`);
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.websocket && this.websocket.readyState === WebSocket.OPEN;
  }

  /**
   * Set test callback for specific events
   * @param {string} event - Event name
   * @param {function} callback - Callback function
   */
  setTestCallback(event, callback) {
    this.testCallbacks[event] = callback;
    console.log(`${LOG_PREFIXES.NOTIFICATION} Test callback set for event: ${event}`);
  }

  // Private Methods

  /**
   * Setup WebSocket event handlers
   */
  setupWebSocketEventHandlers() {
    if (!this.websocket) return;

    this.websocket.onopen = () => {
      console.log(`${LOG_PREFIXES.SUCCESS} Notifications WebSocket connected successfully`);
      this.isConnecting = false;
      this.clearReconnectTimeout();
      this.emitEvent('connected');
    };

    this.websocket.onmessage = (event) => {
      this.handleWebSocketMessage(event);
    };

    this.websocket.onclose = (event) => {
      console.log(`${LOG_PREFIXES.NOTIFICATION} WebSocket connection closed:`, {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      
      this.isConnecting = false;
      this.emitEvent('disconnected', { code: event.code, reason: event.reason });
      
      // Only attempt to reconnect if the connection was not closed cleanly
      if (this.shouldReconnect && !event.wasClean && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.websocket.onerror = (error) => {
      console.error(`${LOG_PREFIXES.ERROR} WebSocket error:`, {
        error: error,
        type: error.type,
        readyState: this.websocket?.readyState,
        readyStateText: WEBSOCKET_STATE_NAMES[this.websocket?.readyState] || 'unknown'
      });
      
      this.isConnecting = false;
      this.emitEvent('error', error);
    };
  }

  /**
   * Handle incoming WebSocket messages
   * @param {MessageEvent} event - WebSocket message event
   */
  handleWebSocketMessage(event) {
    console.log(`${LOG_PREFIXES.NOTIFICATION} Message received:`, event.data);
    
    try {
      const data = JSON.parse(event.data);
      this.processNotificationMessage(data);
    } catch (error) {
      console.log(`${LOG_PREFIXES.INFO} Non-JSON message received:`, event.data);
    }
  }

  /**
   * Process parsed notification message
   * @param {Object} data - Parsed message data
   */
  processNotificationMessage(data) {
    // Add test-specific handling
    if (this.testMode && data.test_id === this.testId) {
      console.log(`${LOG_PREFIXES.NOTIFICATION} [TEST ${this.testId}] Received test message:`, data);
    }

    // Handle external camera control messages
    if (data.type === NOTIFICATION_TYPES.EXTERNAL_CAMERA_CONTROL || data.type === 'external_camera_control') {
      console.log(`${LOG_PREFIXES.NOTIFICATION} 🎯 EXTERNAL CAMERA TRIGGER:`, data);
      
      // Call the test callback if set
      if (this.onExternalCameraTrigger) {
        this.onExternalCameraTrigger(data);
      }

      // Trigger test callback if in test mode
      if (this.testMode && this.testCallbacks.onExternalTrigger) {
        this.testCallbacks.onExternalTrigger(data);
      }
      
      if (data.action === EXTERNAL_CAMERA_ACTIONS.ACTIVATE || data.action === 'activate') {
        this.emitEvent('externalCameraActivate', data);
      } else if (data.action === EXTERNAL_CAMERA_ACTIONS.DEACTIVATE || data.action === 'deactivate') {
        this.emitEvent('externalCameraDeactivate', data);
      }
      return;
    }

    // Handle bee notification messages
    if (data.type === NOTIFICATION_TYPES.BEE_NOTIFICATION) {
      this.addNotification(data);
      return;
    }

    // Emit generic notification event for other message types
    this.emitEvent('notification', data);
  }

  /**
   * Add a new notification to the list
   * @param {Object} notificationData - Notification data
   */
  addNotification(notificationData) {
    const newNotification = {
      id: Date.now(),
      event_type: notificationData.event_type,
      message: notificationData.message,
      timestamp: new Date(notificationData.timestamp),
      read: false
    };

    // Keep only the last 50 notifications
    this.notifications = [newNotification, ...this.notifications.slice(0, DEFAULT_CONFIG.MAX_NOTIFICATIONS - 1)];
    this.unreadCount++;
    
    console.log(`${LOG_PREFIXES.NOTIFICATION} New notification added:`, newNotification);
    this.emitEvent('newNotification', newNotification);
    this.emitEvent('notificationsUpdated', this.getNotifications());
  }

  /**
   * Load existing notifications from database
   */
  async loadNotificationsFromDB() {
    try {
      const response = await fetch(`${this.backendUrl}${API_ENDPOINTS.NOTIFICATIONS}`);
      if (response.ok) {
        const data = await response.json();
        this.notifications = data.notifications || [];
        this.unreadCount = this.notifications.filter(n => !n.read).length;
        
        console.log(`${LOG_PREFIXES.SUCCESS} Loaded ${this.notifications.length} notifications from database`);
        this.emitEvent('notificationsUpdated', this.getNotifications());
      }
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Error loading notifications from database:`, error);
    }
  }

  /**
   * Schedule reconnection after delay
   */
  scheduleReconnect() {
    if (!this.shouldReconnect) return;
    
    this.clearReconnectTimeout();
    console.log(`${LOG_PREFIXES.NOTIFICATION} Scheduling reconnect in ${DEFAULT_CONFIG.RECONNECT_DELAY}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      console.log(`${LOG_PREFIXES.NOTIFICATION} Attempting to reconnect...`);
      this.connect();
    }, DEFAULT_CONFIG.RECONNECT_DELAY);
  }

  /**
   * Clear reconnection timeout
   */
  clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
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
          console.error(`${LOG_PREFIXES.ERROR} Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
const notificationService = new NotificationService();
export default notificationService;