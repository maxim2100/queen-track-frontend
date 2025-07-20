/* eslint-disable no-console */
import {
  WEBSOCKET_URLS,
  DEFAULT_CONFIG,
  STREAM_MODES,
  CAMERA_STATUS,
  WEBSOCKET_STATE_NAMES,
  LOG_PREFIXES
} from '../constants';

class StreamService {
  constructor() {
    this.websocket = null;
    this.isConnected = false;
    this.isStreaming = false;
    this.streamMode = STREAM_MODES.VIDEO;
    this.frameInterval = null;
    this.canvas = null;
    this.context = null;
    this.listeners = new Map();
    
    // Configuration
    this.websocketUrl = process.env.REACT_APP_WEBSOCKET_URL;
    this.backendUrl = process.env.REACT_APP_BACKEND_URL;
    
    // Video/Camera references
    this.videoElement = null;
    this.stream = null;
    
    // State tracking
    this.lastBeeStatus = null;
    this.eventActive = false;
    this.positionHistoryCount = 0;
    this.consecutiveDetections = { inside: 0, outside: 0 };
    this.statusSequence = [];
    this.eventAction = null;
    this.transitionDetected = false;
    
    // Connection stability
    this.heartbeatInterval = null;
    this.lastPongTime = null;
    this.connectionQuality = 'good';
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    
    this.initializeCanvas();
  }

  // Public API Methods

  /**
   * Initialize the stream service
   */
  async initialize() {
    try {
      console.log(`${LOG_PREFIXES.STREAM} Initializing stream service`);
      this.initializeCanvas();
      return true;
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Failed to initialize stream service:`, error);
      return false;
    }
  }

  /**
   * Destroy the stream service and cleanup resources
   */
  destroy() {
    console.log(`${LOG_PREFIXES.STREAM} Destroying stream service`);
    this.stopStreaming();
    this.disconnect();
    this.cleanupResources();
    this.listeners.clear();
  }

  /**
   * Start streaming with specified mode and video element
   * @param {string} mode - Stream mode (live or video)
   * @param {HTMLVideoElement} videoElement - Video element reference
   * @param {MediaStream} stream - Media stream (for live mode)
   */
  async startStreaming(mode, videoElement, stream = null) {
    try {
      console.log(`${LOG_PREFIXES.STREAM} Starting streaming in ${mode} mode`);
      
      this.streamMode = mode;
      this.videoElement = videoElement;
      this.stream = stream;
      
      // Connect to WebSocket
      await this.connect();
      
      // Start frame sending
      this.startFrameSending();
      
      this.isStreaming = true;
      this.emitEvent('streamingStarted', { mode, videoElement });
      
      return true;
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Failed to start streaming:`, error);
      this.emitEvent('streamingError', error);
      return false;
    }
  }

  /**
   * Stop streaming and cleanup
   */
  stopStreaming() {
    console.log(`${LOG_PREFIXES.STREAM} Stopping streaming`);
    
    this.stopFrameSending();
    this.disconnect();
    this.resetState();
    
    this.isStreaming = false;
    this.emitEvent('streamingStopped');
  }

  /**
   * Connect to streaming WebSocket
   */
  async connect() {
    if (this.isConnected || (this.websocket && this.websocket.readyState === WebSocket.OPEN)) {
      console.log(`${LOG_PREFIXES.WARNING} Already connected to streaming WebSocket`);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const fullUrl = `${this.websocketUrl}${WEBSOCKET_URLS.LIVE_STREAM}`;
      
      console.log(`${LOG_PREFIXES.STREAM} Connecting to:`, fullUrl);
      console.log(`${LOG_PREFIXES.INFO} Environment:`, {
        REACT_APP_WEBSOCKET_URL: process.env.REACT_APP_WEBSOCKET_URL,
        REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL,
        NODE_ENV: process.env.NODE_ENV
      });

      try {
        this.websocket = new WebSocket(fullUrl);
        this.setupWebSocketEventHandlers(resolve, reject);
      } catch (error) {
        console.error(`${LOG_PREFIXES.ERROR} Failed to create streaming WebSocket:`, error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from streaming WebSocket
   */
  disconnect() {
    if (this.websocket && this.websocket.readyState !== WebSocket.CLOSED) {
      try {
        this.websocket.close(1000, 'Service disconnect');
      } catch (error) {
        console.warn(`${LOG_PREFIXES.WARNING} Error closing streaming WebSocket:`, error);
      }
    }
    this.websocket = null;
    this.isConnected = false;
  }

  /**
   * Add event listener
   * @param {string} eventType - Event type
   * @param {function} callback - Callback function
   */
  addEventListener(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
    
    console.log(`${LOG_PREFIXES.STREAM} Added listener for event:`, eventType);
  }

  /**
   * Remove event listener
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
   * Get current connection status
   */
  getConnectionStatus() {
    if (!this.websocket) return 'disconnected';
    return WEBSOCKET_STATE_NAMES[this.websocket.readyState] || 'unknown';
  }

  /**
   * Get current streaming state
   */
  getStreamingState() {
    return {
      isStreaming: this.isStreaming,
      isConnected: this.isConnected,
      streamMode: this.streamMode,
      lastBeeStatus: this.lastBeeStatus,
      eventActive: this.eventActive,
      positionHistoryCount: this.positionHistoryCount,
      consecutiveDetections: this.consecutiveDetections,
      statusSequence: this.statusSequence,
      eventAction: this.eventAction,
      transitionDetected: this.transitionDetected
    };
  }

  // Private Methods

  /**
   * Initialize canvas for frame capture
   */
  initializeCanvas() {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
  }

  /**
   * Setup WebSocket event handlers
   */
  setupWebSocketEventHandlers(resolve, reject) {
    if (!this.websocket) return;

    this.websocket.onopen = () => {
      console.log(`${LOG_PREFIXES.SUCCESS} Streaming WebSocket connected successfully`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.connectionQuality = 'good';
      this.startHeartbeat();
      this.emitEvent('connected');
      if (resolve) resolve();
    };

    this.websocket.onmessage = (event) => {
      this.handleWebSocketMessage(event);
    };

    this.websocket.onclose = (event) => {
      console.log(`${LOG_PREFIXES.STREAM} WebSocket connection closed:`, {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      
      this.isConnected = false;
      this.stopFrameSending();
      this.stopHeartbeat();
      this.emitEvent('disconnected', { code: event.code, reason: event.reason });
      
      // Auto-reconnect if needed
      if (this.shouldReconnect && this.isStreaming && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.websocket.onerror = (error) => {
      console.error(`${LOG_PREFIXES.ERROR} Streaming WebSocket error:`, {
        error: error,
        type: error.type,
        readyState: this.websocket?.readyState,
        readyStateText: WEBSOCKET_STATE_NAMES[this.websocket?.readyState] || 'unknown'
      });
      
      this.isConnected = false;
      this.emitEvent('error', error);
      if (reject) reject(error);
    };
  }

  /**
   * Handle incoming WebSocket messages
   * @param {MessageEvent} event - WebSocket message event
   */
  handleWebSocketMessage(event) {
    try {
      const data = JSON.parse(event.data);
      this.processStreamMessage(data);
    } catch (error) {
      // Non-JSON message, ignore
      console.log(`${LOG_PREFIXES.INFO} Non-JSON stream message received:`, event.data);
    }
  }

  /**
   * Process parsed stream message
   * @param {Object} data - Parsed message data
   */
  processStreamMessage(data) {
    let stateChanged = false;
    
    // Handle pong responses
    if (data.type === 'pong') {
      this.lastPongTime = Date.now();
      this.connectionQuality = 'good';
      return;
    }
    
    // Handle ping requests
    if (data.type === 'ping') {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
      return;
    }
    
    // Update bee status
    if (data.bee_status && data.bee_status !== this.lastBeeStatus) {
      this.lastBeeStatus = data.bee_status;
      stateChanged = true;
      this.emitEvent('beeStatusChanged', this.lastBeeStatus);
    }

    // Update external camera status
    if (data.external_camera_status !== undefined) {
      const status = data.external_camera_status ? CAMERA_STATUS.ACTIVE : CAMERA_STATUS.INACTIVE;
      this.emitEvent('externalCameraStatusChanged', status);
    }

    // Update event action
    if (data.event_action !== undefined && data.event_action !== this.eventAction) {
      this.eventAction = data.event_action;
      this.transitionDetected = data.event_action !== null;
      stateChanged = true;
      
      this.emitEvent('eventActionChanged', {
        action: this.eventAction,
        transitionDetected: this.transitionDetected
      });

      // Clear event action indicator after 3 seconds
      if (data.event_action) {
        setTimeout(() => {
          this.eventAction = null;
          this.transitionDetected = false;
          this.emitEvent('eventActionChanged', {
            action: this.eventAction,
            transitionDetected: this.transitionDetected
          });
        }, 3000);
      }
    }

    // Update position history count
    if (data.position_history_count !== undefined && data.position_history_count !== this.positionHistoryCount) {
      this.positionHistoryCount = data.position_history_count;
      stateChanged = true;
    }

    // Update consecutive detections
    if (data.consecutive_inside !== undefined && data.consecutive_outside !== undefined) {
      this.consecutiveDetections = {
        inside: data.consecutive_inside,
        outside: data.consecutive_outside
      };
      stateChanged = true;
    }

    // Update event active status
    if (data.event_active !== undefined && data.event_active !== this.eventActive) {
      this.eventActive = data.event_active;
      stateChanged = true;
      this.emitEvent('eventActiveChanged', this.eventActive);
    }

    // Update status sequence
    if (data.status_sequence !== undefined) {
      this.statusSequence = data.status_sequence;
      stateChanged = true;
    }

    // Emit general state update if anything changed
    if (stateChanged) {
      this.emitEvent('stateUpdated', this.getStreamingState());
    }
  }

  /**
   * Start sending frames to server
   */
  startFrameSending() {
    if (this.frameInterval) {
      this.stopFrameSending();
    }

    console.log(`${LOG_PREFIXES.STREAM} Starting frame sending (${this.streamMode} mode)`);
    
    this.frameInterval = setInterval(() => {
      this.sendFrame();
    }, DEFAULT_CONFIG.FRAME_SEND_INTERVAL);
  }

  /**
   * Stop sending frames
   */
  stopFrameSending() {
    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
      console.log(`${LOG_PREFIXES.STREAM} Stopped frame sending`);
    }
  }

  /**
   * Send a single frame to the server
   */
  sendFrame() {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN || !this.videoElement) {
      return;
    }

    // Check if video is ready for capture
    if (this.streamMode === STREAM_MODES.VIDEO) {
      if (this.videoElement.paused || this.videoElement.ended) {
        return;
      }
    }

    try {
      // Set canvas dimensions to match video
      this.canvas.width = this.videoElement.videoWidth;
      this.canvas.height = this.videoElement.videoHeight;
      
      if (this.canvas.width === 0 || this.canvas.height === 0) {
        return; // Video not yet loaded
      }

      // Draw current video frame to canvas
      this.context.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
      
      // Convert to blob and send
      this.canvas.toBlob((blob) => {
        if (blob && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send(blob);
        }
      }, 'image/jpeg');
      
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Error sending frame:`, error);
    }
  }

  /**
   * Reset internal state
   */
  resetState() {
    this.lastBeeStatus = null;
    this.eventActive = false;
    this.positionHistoryCount = 0;
    this.consecutiveDetections = { inside: 0, outside: 0 };
    this.statusSequence = [];
    this.eventAction = null;
    this.transitionDetected = false;
  }

  /**
   * Cleanup resources
   */
  cleanupResources() {
    this.stopFrameSending();
    this.stopHeartbeat();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.videoElement = null;
    this.canvas = null;
    this.context = null;
  }

  /**
   * Start heartbeat mechanism to keep connection alive
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.lastPongTime = Date.now();
    this.heartbeatInterval = setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        try {
          this.websocket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          
          // Check if we haven't received a pong in a while
          if (Date.now() - this.lastPongTime > 15000) { // 15 seconds
            console.warn(`${LOG_PREFIXES.WARNING} No pong received, connection may be unstable`);
            this.connectionQuality = 'poor';
          }
        } catch (error) {
          console.error(`${LOG_PREFIXES.ERROR} Failed to send ping:`, error);
        }
      }
    }, 10000); // Send ping every 10 seconds
  }

  /**
   * Stop heartbeat mechanism
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    console.log(`${LOG_PREFIXES.STREAM} Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(async () => {
      if (this.shouldReconnect && this.isStreaming) {
        try {
          console.log(`${LOG_PREFIXES.STREAM} Attempting to reconnect...`);
          await this.connect();
          
          // Resume streaming if we were streaming before
          if (this.videoElement) {
            this.startFrameSending();
          }
        } catch (error) {
          console.error(`${LOG_PREFIXES.ERROR} Reconnection failed:`, error);
          if (this.reconnectAttempts < 5) {
            this.scheduleReconnect();
          } else {
            console.error(`${LOG_PREFIXES.ERROR} Max reconnection attempts reached`);
            this.emitEvent('streamingError', new Error('Connection lost and unable to reconnect'));
          }
        }
      }
    }, delay);
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
          console.error(`${LOG_PREFIXES.ERROR} Error in stream event listener for ${eventType}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
const streamService = new StreamService();
export default streamService;