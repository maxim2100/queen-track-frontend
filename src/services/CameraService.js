/* eslint-disable no-console */
import {
  API_ENDPOINTS,
  DEFAULT_CONFIG,
  CAMERA_STATUS,
  ERROR_TYPES,
  ERROR_MESSAGES,
  WEBSOCKET_URLS,
  LOG_PREFIXES
} from '../constants';

class CameraService {
  constructor() {
    this.devices = [];
    this.selectedInternalDeviceId = '';
    this.selectedExternalDeviceId = '';
    this.internalStream = null;
    this.externalStream = null;
    this.externalWebSocket = null;
    this.listeners = new Map();
    
    // Configuration
    this.websocketUrl = process.env.REACT_APP_WEBSOCKET_URL;
    this.backendUrl = process.env.REACT_APP_BACKEND_URL;
    
    // Retry management
    this.retryAttempts = new Map();
    this.lastRetryTime = 0;
    
    // State flags
    this.userIsSelecting = false;
    this.configLoadTimeout = null;
    this.didEnumerate = false;
    this.externalCameraActive = false;
    this.externalCameraStatus = CAMERA_STATUS.INACTIVE;
    
    // Error state management
    this.lastErrorStates = new Map();
    this.errorRecoveryAttempts = new Map();
    this.permissionStatus = 'unknown'; // 'granted', 'denied', 'prompt', 'unknown'
  }

  // Public API Methods

  /**
   * Initialize the camera service
   */
  async initialize() {
    try {
      console.log(`${LOG_PREFIXES.CAMERA} Initializing camera service`);
      // Don't automatically enumerate devices during initialization
      // This prevents the camera from being accessed when the app loads
      console.log(`${LOG_PREFIXES.CAMERA} Camera service initialized - devices will be enumerated on demand`);
      return true;
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Failed to initialize camera service:`, error);
      return false;
    }
  }

  /**
   * Destroy the camera service and cleanup resources
   */
  destroy() {
    console.log(`${LOG_PREFIXES.CAMERA} Destroying camera service`);
    this.stopAllCameras();
    this.cleanup();
    this.listeners.clear();
  }

  /**
   * Enumerate available camera devices
   * @param {boolean} requestPermissions - Whether to request camera permissions
   * @param {boolean} preserveSelections - Whether to preserve current selections
   */
  async enumerateDevices(requestPermissions = false, preserveSelections = true) {
    try {
      console.log(`${LOG_PREFIXES.CAMERA} Enumerating devices (permissions: ${requestPermissions}, preserve: ${preserveSelections})`);
      
      if (!navigator.mediaDevices) {
        console.error(`${LOG_PREFIXES.ERROR} Media devices not available`);
        this.devices = [];
        this.emitEvent('devicesUpdated', []);
        return false;
      }

      // Request permissions if needed
      if (requestPermissions) {
        try {
          console.log(`${LOG_PREFIXES.CAMERA} Requesting camera permissions`);
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          tempStream.getTracks().forEach(track => track.stop());
          console.log(`${LOG_PREFIXES.SUCCESS} Camera permissions granted`);
          this.permissionStatus = 'granted';
        } catch (permError) {
          console.error(`${LOG_PREFIXES.ERROR} Camera permissions denied:`, permError);
          this.permissionStatus = 'denied';
          this.devices = [];
          this.emitEvent('devicesUpdated', []);
          this.emitEvent('permissionError', permError);
          return false;
        }
      }

      let devices = await navigator.mediaDevices.enumerateDevices();
      let cameras = devices.filter(device => device.kind === 'videoinput');
      
      // If device labels are empty and we haven't requested permissions yet, try to get them
      const hasEmptyLabels = cameras.some(camera => !camera.label || camera.label === '');
      if (hasEmptyLabels && !requestPermissions && this.permissionStatus !== 'denied') {
        console.log(`${LOG_PREFIXES.CAMERA} Device labels empty, requesting permissions to get proper names`);
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          tempStream.getTracks().forEach(track => track.stop());
          
          // Re-enumerate after getting permissions
          devices = await navigator.mediaDevices.enumerateDevices();
          cameras = devices.filter(device => device.kind === 'videoinput');
          this.permissionStatus = 'granted';
          console.log(`${LOG_PREFIXES.SUCCESS} Re-enumerated devices with labels after permission grant`);
        } catch (permError) {
          console.warn(`${LOG_PREFIXES.WARNING} Could not get permissions for device labels:`, permError);
          this.permissionStatus = 'denied';
        }
      }
      
      console.log(`${LOG_PREFIXES.SUCCESS} Found ${cameras.length} cameras:`, cameras);
      
      // Store current selections
      const currentInternalId = this.selectedInternalDeviceId;
      const currentExternalId = this.selectedExternalDeviceId;
      
      this.devices = cameras;
      
      if (cameras.length > 0) {
        // Set default devices if not preserving selections or no current selection
        if (!preserveSelections || !currentInternalId) {
          if (!currentInternalId) {
            this.selectedInternalDeviceId = cameras[0].deviceId;
          }
        }
        
        if (!preserveSelections || !currentExternalId) {
          if (!currentExternalId) {
            this.selectedExternalDeviceId = cameras.length > 1 ? cameras[1].deviceId : cameras[0].deviceId;
          }
        }
        
        // Load saved configuration if not preserving user selections
        if (!preserveSelections) {
          this.scheduleConfigLoad(true, false);
        }
        
        this.didEnumerate = true;
        this.emitEvent('devicesUpdated', cameras);
        return true;
      } else {
        console.warn(`${LOG_PREFIXES.WARNING} No cameras found`);
        this.emitEvent('devicesUpdated', []);
        return false;
      }
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Error enumerating devices:`, error);
      this.devices = [];
      this.emitEvent('devicesUpdated', []);
      this.emitEvent('enumerationError', error);
      return false;
    }
  }

  /**
   * Get user media stream for internal camera
   * @param {string} deviceId - Device ID to use
   */
  async getInternalCameraStream(deviceId) {
    try {
      console.log(`${LOG_PREFIXES.CAMERA} Getting internal camera stream:`, deviceId);
      
      if (!deviceId) {
        throw new Error('No device ID provided');
      }

      if (!navigator.mediaDevices) {
        throw new Error('Camera access not available. Requires HTTPS or localhost.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: { exact: deviceId },
          width: { ideal: 1280 }, // Higher resolution for main camera
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      });

      this.internalStream = stream;
      this.selectedInternalDeviceId = deviceId;
      
      console.log(`${LOG_PREFIXES.SUCCESS} Internal camera stream acquired`);
      this.emitEvent('internalStreamStarted', stream);
      
      return stream;
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Error getting internal camera stream:`, error);
      this.emitEvent('internalStreamError', this.formatCameraError(error));
      throw error;
    }
  }

  /**
   * Stop internal camera stream
   */
  stopInternalCamera() {
    console.log(`${LOG_PREFIXES.CAMERA} Stopping internal camera`);
    
    if (this.internalStream) {
      this.internalStream.getTracks().forEach(track => track.stop());
      this.internalStream = null;
      this.emitEvent('internalStreamStopped');
    }
  }

  /**
   * Start external camera with device ID
   * @param {string} deviceId - Device ID to use
   */
  async startExternalCamera(deviceId) {
    try {
      console.log(`${LOG_PREFIXES.CAMERA} Starting external camera:`, deviceId);
      
      if (this.externalCameraActive) {
        console.log(`${LOG_PREFIXES.WARNING} External camera already active`);
        return;
      }
      
      if (!deviceId) {
        throw new Error('No device ID provided');
      }
      
      if (!navigator.mediaDevices) {
        throw new Error('Media devices not available');
      }
      
      let stream;
      
      // Check if trying to use the same device as internal camera
      if (deviceId === this.selectedInternalDeviceId && this.internalStream) {
        console.log(`${LOG_PREFIXES.CAMERA} Same device detected - sharing internal stream for external camera`);
        
        try {
          // Clone the existing internal stream instead of requesting new access
          stream = this.internalStream.clone();
          console.log(`${LOG_PREFIXES.SUCCESS} Successfully cloned internal stream for external camera`);
          
          // Emit event indicating stream sharing
          this.emitEvent('streamShared', {
            internalDeviceId: this.selectedInternalDeviceId,
            externalDeviceId: deviceId,
            sharedStream: true
          });
          
        } catch (cloneError) {
          console.error(`${LOG_PREFIXES.ERROR} Failed to clone stream:`, cloneError);
          throw new Error(`Cannot share camera stream: ${cloneError.message}`);
        }
      } else {
        // Different devices - try to get separate stream
        console.log(`${LOG_PREFIXES.CAMERA} Different devices - requesting separate stream`);
        
        try {
          // First attempt: try with exact device ID
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              deviceId: { exact: deviceId },
              width: { ideal: 640 }, // Lower resolution for external camera
              height: { ideal: 480 },
              frameRate: { ideal: 15 } // Lower framerate to reduce resource usage
            }
          });
          console.log(`${LOG_PREFIXES.SUCCESS} External camera stream acquired with separate device`);
          
        } catch (error) {
          console.warn(`${LOG_PREFIXES.WARNING} Failed with exact constraints, trying relaxed constraints:`, error);
          
          // Second attempt: try with ideal device ID (allows fallback)
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { 
                deviceId: { ideal: deviceId },
                width: { max: 640 },
                height: { max: 480 },
                frameRate: { max: 15 }
              }
            });
            console.log(`${LOG_PREFIXES.SUCCESS} External camera stream acquired with relaxed constraints`);
            
          } catch (fallbackError) {
            console.error(`${LOG_PREFIXES.ERROR} All attempts to get separate camera stream failed:`, fallbackError);
            throw fallbackError;
          }
        }
      }
      
      this.externalStream = stream;
      this.selectedExternalDeviceId = deviceId;
      this.externalCameraActive = true;
      this.externalCameraStatus = CAMERA_STATUS.ACTIVE;
      
      // Start WebSocket connection for external camera
      await this.startExternalCameraWebSocket();
      
      console.log(`${LOG_PREFIXES.SUCCESS} External camera started successfully`);
      this.emitEvent('externalCameraStarted', { stream, deviceId });
      
      // Reset retry counters on success
      this.retryAttempts.clear();
      this.lastRetryTime = 0;
      
      return stream;
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Error starting external camera:`, error);
      
      this.externalCameraStatus = CAMERA_STATUS.ERROR;
      const formattedError = this.formatCameraError(error, deviceId);
      this.emitEvent('externalCameraError', formattedError);
      
      // Handle automatic recovery
      await this.handleExternalCameraRecovery(error, deviceId);
      
      throw error;
    }
  }

  /**
   * Stop external camera
   */
  stopExternalCamera() {
    console.log(`${LOG_PREFIXES.CAMERA} Stopping external camera`);
    
    try {
      // Stop camera stream
      if (this.externalStream) {
        this.externalStream.getTracks().forEach(track => track.stop());
        this.externalStream = null;
      }
      
      // Close WebSocket
      if (this.externalWebSocket && this.externalWebSocket.readyState !== WebSocket.CLOSED) {
        try {
          this.externalWebSocket.close();
        } catch (error) {
          console.warn(`${LOG_PREFIXES.WARNING} Error closing external WebSocket:`, error);
        }
        this.externalWebSocket = null;
      }
      
      this.externalCameraActive = false;
      this.externalCameraStatus = CAMERA_STATUS.INACTIVE;
      
      // Reset retry counters
      this.retryAttempts.clear();
      this.lastRetryTime = 0;
      
      this.emitEvent('externalCameraStopped');
      console.log(`${LOG_PREFIXES.SUCCESS} External camera stopped successfully`);
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Error stopping external camera:`, error);
    }
  }

  /**
   * Save camera configuration to server
   */
  async saveCameraConfig() {
    try {
      console.log(`${LOG_PREFIXES.CAMERA} Saving camera configuration:`, {
        internal: this.selectedInternalDeviceId,
        external: this.selectedExternalDeviceId
      });
      
      const response = await fetch(`${this.backendUrl}${API_ENDPOINTS.CAMERA_CONFIG}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          internal_camera_id: this.selectedInternalDeviceId,
          external_camera_id: this.selectedExternalDeviceId
        }),
      });
      
      if (response.ok) {
        console.log(`${LOG_PREFIXES.SUCCESS} Camera configuration saved successfully`);
        this.emitEvent('configSaved', {
          internal: this.selectedInternalDeviceId,
          external: this.selectedExternalDeviceId
        });
        return true;
      } else {
        console.error(`${LOG_PREFIXES.ERROR} Failed to save camera configuration`);
        return false;
      }
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Error saving camera config:`, error);
      return false;
    }
  }

  /**
   * Load camera configuration from server
   */
  async loadCameraConfig(skipIfUserSelecting = true, respectUserSelections = true) {
    try {
      if (skipIfUserSelecting && this.userIsSelecting) {
        console.log(`${LOG_PREFIXES.CAMERA} Skipping config load - user is selecting`);
        return;
      }

      const response = await fetch(`${this.backendUrl}${API_ENDPOINTS.EXTERNAL_CAMERA_STATUS}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`${LOG_PREFIXES.SUCCESS} Loaded camera configuration:`, data);
        
        // Set internal camera if conditions are met
        if (!respectUserSelections || !this.selectedInternalDeviceId) {
          if (data.internal_camera_id && this.devices.some(d => d.deviceId === data.internal_camera_id)) {
            this.selectedInternalDeviceId = data.internal_camera_id;
          }
        }
        
        // Set external camera if conditions are met
        if (!respectUserSelections || !this.selectedExternalDeviceId) {
          if (data.external_camera_id && this.devices.some(d => d.deviceId === data.external_camera_id)) {
            this.selectedExternalDeviceId = data.external_camera_id;
            console.log(`${LOG_PREFIXES.SUCCESS} External camera loaded:`, data.external_camera_id);
          }
        }
        
        this.emitEvent('configLoaded', {
          internal: this.selectedInternalDeviceId,
          external: this.selectedExternalDeviceId
        });
      }
    } catch (error) {
      console.error(`${LOG_PREFIXES.ERROR} Error loading camera config:`, error);
    }
  }

  /**
   * Set selected internal camera device
   * @param {string} deviceId - Device ID
   */
  setInternalCameraDevice(deviceId) {
    console.log(`${LOG_PREFIXES.CAMERA} Setting internal camera device:`, deviceId);
    this.userIsSelecting = true;
    this.clearConfigLoadTimeout();
    
    this.selectedInternalDeviceId = deviceId;
    this.emitEvent('internalDeviceChanged', deviceId);
    
    // Auto-save configuration
    setTimeout(() => this.saveCameraConfig(), 500);
    
    // Clear user selection flag
    setTimeout(() => {
      this.userIsSelecting = false;
    }, 2000);
  }

  /**
   * Set selected external camera device
   * @param {string} deviceId - Device ID
   */
  setExternalCameraDevice(deviceId) {
    console.log(`${LOG_PREFIXES.CAMERA} Setting external camera device:`, deviceId);
    this.userIsSelecting = true;
    this.clearConfigLoadTimeout();
    
    this.selectedExternalDeviceId = deviceId;
    this.emitEvent('externalDeviceChanged', deviceId);
    
    // Auto-save configuration
    setTimeout(() => this.saveCameraConfig(), 500);
    
    // Clear user selection flag
    setTimeout(() => {
      this.userIsSelecting = false;
    }, 2000);
  }

  /**
   * Get current camera state
   */
  getCameraState() {
    return {
      devices: [...this.devices],
      selectedInternalDeviceId: this.selectedInternalDeviceId,
      selectedExternalDeviceId: this.selectedExternalDeviceId,
      internalStreamActive: !!this.internalStream,
      externalCameraActive: this.externalCameraActive,
      externalCameraStatus: this.externalCameraStatus,
      retryAttempts: new Map(this.retryAttempts),
      lastRetryTime: this.lastRetryTime
    };
  }

  /**
   * Start both cameras simultaneously
   * @param {string} internalDeviceId - Internal camera device ID
   * @param {string} externalDeviceId - External camera device ID
   * @returns {Object} Result with both streams or error information
   */
  async startBothCameras(internalDeviceId, externalDeviceId) {
    console.log(`${LOG_PREFIXES.CAMERA} Attempting to start both cameras simultaneously`);
    
    const result = {
      internalSuccess: false,
      externalSuccess: false,
      internalStream: null,
      externalStream: null,
      errors: [],
      concurrentAccessAttempted: false
    };
    
    try {
      // First, try to start internal camera
      console.log(`${LOG_PREFIXES.CAMERA} Starting internal camera first...`);
      result.internalStream = await this.getInternalCameraStream(internalDeviceId);
      result.internalSuccess = true;
      
      // Give a brief delay to ensure internal camera is fully initialized
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now try external camera
      console.log(`${LOG_PREFIXES.CAMERA} Starting external camera...`);
      
      if (internalDeviceId === externalDeviceId) {
        result.concurrentAccessAttempted = true;
        console.log(`${LOG_PREFIXES.WARNING} Both cameras use same device - attempting concurrent access`);
      }
      
      try {
        await this.startExternalCamera(externalDeviceId);
        result.externalSuccess = true;
        
        console.log(`${LOG_PREFIXES.SUCCESS} Both cameras started successfully!`);
        this.emitEvent('bothCamerasStarted', result);
        
      } catch (externalError) {
        console.warn(`${LOG_PREFIXES.WARNING} External camera failed, but internal camera is working`);
        result.errors.push({
          camera: 'external',
          error: externalError,
          formatted: this.formatCameraError(externalError, externalDeviceId)
        });
        
        // Emit partial success event
        this.emitEvent('partialCameraSuccess', result);
      }
      
    } catch (internalError) {
      console.error(`${LOG_PREFIXES.ERROR} Internal camera failed to start`);
      result.errors.push({
        camera: 'internal',
        error: internalError,
        formatted: this.formatCameraError(internalError, internalDeviceId)
      });
      
      this.emitEvent('bothCamerasFailed', result);
    }
    
    return result;
  }

  /**
   * Get available cameras for testing
   * @returns {Array} Array of camera devices
   */
  async getAvailableCameras() {
    try {
      // First check if we have any video devices
      const initialDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = initialDevices.filter(device => device.kind === 'videoinput');
      
      // If no devices found, return empty array
      if (videoDevices.length === 0) {
        console.error('No camera devices found');
        return [];
      }
      
      // Check if labels are missing
      const hasLabels = videoDevices.some(device => device.label && device.label.length > 0);
      
      if (!hasLabels) {
        try {
          console.log('Camera labels not available - requesting permissions');
          // Try both audio and video permissions for more reliable label access
          const tempStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
          }).catch(() => {
            // If audio+video fails, try just video
            return navigator.mediaDevices.getUserMedia({ video: true });
          });
          
          // Make sure to stop all tracks
          if (tempStream) {
            tempStream.getTracks().forEach(track => track.stop());
          }
          
          // Re-enumerate after permissions
          const updatedDevices = await navigator.mediaDevices.enumerateDevices();
          return updatedDevices.filter(device => device.kind === 'videoinput');
        } catch (error) {
          console.warn('Failed to get camera permissions for labels:', error);
          // Fall back to devices without labels
          return videoDevices;
        }
      }
      
      // Already had labels, return the devices
      return videoDevices;
    } catch (error) {
      console.error('Failed to enumerate cameras:', error);
      return [];
    }
  }

  /**
   * Start camera with specific device ID for testing
   * @param {string} deviceId - Device ID to start
   * @returns {MediaStream} Camera stream
   */
  async startCamera(deviceId) {
    try {
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      console.error('Failed to start camera:', error);
      throw error;
    }
  }

  /**
   * Get camera capabilities for testing
   * @param {string} deviceId - Device ID to check
   * @returns {Object} Camera capabilities
   */
  async getCameraCapabilities(deviceId) {
    try {
      const stream = await this.startCamera(deviceId);
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      
      // Clean up
      stream.getTracks().forEach(track => track.stop());
      
      return capabilities;
    } catch (error) {
      console.error('Failed to get camera capabilities:', error);
      return null;
    }
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

  // Private Methods

  /**
   * Start external camera WebSocket connection
   */
  async startExternalCameraWebSocket() {
    const fullUrl = `${this.websocketUrl}${WEBSOCKET_URLS.EXTERNAL_CAMERA}`;
    console.log(`${LOG_PREFIXES.CAMERA} Connecting external camera WebSocket:`, fullUrl);
    
    // Close existing WebSocket
    if (this.externalWebSocket && this.externalWebSocket.readyState !== WebSocket.CLOSED) {
      try {
        this.externalWebSocket.close();
      } catch (error) {
        console.warn(`${LOG_PREFIXES.WARNING} Error closing existing external WebSocket:`, error);
      }
    }
    
    const socket = new WebSocket(fullUrl);
    this.externalWebSocket = socket;
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Create video element for stream
    const video = document.createElement('video');
    video.srcObject = this.externalStream;
    video.play();
    
    const sendFrame = () => {
      if (video && socket.readyState === WebSocket.OPEN && this.externalCameraActive) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) socket.send(blob);
        }, 'image/jpeg');
      }
    };
    
    const intervalId = setInterval(sendFrame, DEFAULT_CONFIG.FRAME_SEND_INTERVAL);
    
    socket.onopen = () => {
      console.log(`${LOG_PREFIXES.SUCCESS} External camera WebSocket connected`);
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`${LOG_PREFIXES.CAMERA} External camera WebSocket status:`, data);
      } catch (error) {
        // Non-JSON message, ignore
      }
    };
    
    socket.onclose = () => {
      console.log(`${LOG_PREFIXES.CAMERA} External camera WebSocket closed`);
      clearInterval(intervalId);
    };
    
    socket.onerror = (error) => {
      console.error(`${LOG_PREFIXES.ERROR} External camera WebSocket error:`, error);
      clearInterval(intervalId);
    };
  }

  /**
   * Handle automatic recovery for external camera errors
   */
  async handleExternalCameraRecovery(error, deviceId) {
    if (error.name === ERROR_TYPES.CAMERA_NOT_READABLE && this.devices.length > 1) {
      const currentRetries = this.retryAttempts.get(deviceId) || 0;
      const maxRetries = DEFAULT_CONFIG.MAX_RETRY_ATTEMPTS;
      const cooldownPeriod = DEFAULT_CONFIG.RETRY_COOLDOWN;
      const currentTime = Date.now();
      
      if (currentRetries >= maxRetries) {
        console.log(`${LOG_PREFIXES.WARNING} Max retries reached for device:`, deviceId);
        
        // Try next available camera
        const otherCameras = this.devices.filter(cam => 
          cam.deviceId !== deviceId && 
          cam.deviceId !== this.selectedInternalDeviceId &&
          (this.retryAttempts.get(cam.deviceId) || 0) < maxRetries
        );
        
        if (otherCameras.length > 0 && (currentTime - this.lastRetryTime) > cooldownPeriod) {
          const nextDevice = otherCameras[0];
          console.log(`${LOG_PREFIXES.CAMERA} Trying recovery with fresh device:`, nextDevice.deviceId);
          this.selectedExternalDeviceId = nextDevice.deviceId;
          this.lastRetryTime = currentTime;
          
          setTimeout(() => {
            this.startExternalCamera(nextDevice.deviceId);
          }, 1000);
        } else {
          console.error(`${LOG_PREFIXES.ERROR} All cameras exhausted or in cooldown`);
          // Reset retry counters after longer cooldown
          setTimeout(() => {
            this.retryAttempts.clear();
            this.lastRetryTime = 0;
          }, DEFAULT_CONFIG.RETRY_RESET_PERIOD);
        }
      } else {
        console.log(`${LOG_PREFIXES.CAMERA} Attempting automatic recovery...`);
        
        // Increment retry counter
        this.retryAttempts.set(deviceId, currentRetries + 1);
        
        // Try next available camera
        const otherCameras = this.devices.filter(cam => 
          cam.deviceId !== deviceId && 
          cam.deviceId !== this.selectedInternalDeviceId &&
          (this.retryAttempts.get(cam.deviceId) || 0) < maxRetries
        );
        
        if (otherCameras.length > 0) {
          const nextDevice = otherCameras[0];
          console.log(`${LOG_PREFIXES.CAMERA} Trying recovery with device:`, nextDevice.deviceId);
          this.selectedExternalDeviceId = nextDevice.deviceId;
          
          setTimeout(() => {
            this.startExternalCamera(nextDevice.deviceId);
          }, 1000);
        }
      }
    }
  }

  /**
   * Format camera error with helpful information
   */
  formatCameraError(error, deviceId = null) {
    const errorInfo = ERROR_MESSAGES[error.name] || {
      he: 'שגיאה לא ידועה',
      solutions: ['נסה שוב מאוחר יותר']
    };
    
    // Update error state tracking
    const errorKey = deviceId || 'general';
    this.lastErrorStates.set(errorKey, {
      error: error.name,
      timestamp: Date.now(),
      deviceId: deviceId
    });
    
    // Increment recovery attempts
    const currentAttempts = this.errorRecoveryAttempts.get(errorKey) || 0;
    this.errorRecoveryAttempts.set(errorKey, currentAttempts + 1);
    
    // Check permission status if it's a permission error
    if (error.name === 'NotAllowedError') {
      this.permissionStatus = 'denied';
    }
    
    return {
      name: error.name,
      message: error.message,
      deviceId: deviceId,
      availableCameras: this.devices.length,
      internalCameraActive: !!this.internalStream,
      internalCameraDevice: this.selectedInternalDeviceId,
      sameDevice: deviceId === this.selectedInternalDeviceId,
      errorMessage: errorInfo.he,
      possibleSolutions: this.getEnhancedSolutions(error, deviceId),
      retryAttempts: this.retryAttempts.get(deviceId) || 0,
      recoveryAttempts: this.errorRecoveryAttempts.get(errorKey) || 0,
      permissionStatus: this.permissionStatus,
      errorType: this.categorizeError(error),
      canRetry: this.canRetryError(error, errorKey)
    };
  }

  /**
   * Get enhanced solutions based on error type and context
   */
  getEnhancedSolutions(error, deviceId) {
    const baseSolutions = ERROR_MESSAGES[error.name]?.solutions || ['נסה שוב מאוחר יותר'];
    const enhancedSolutions = [...baseSolutions];
    
    // Add context-specific solutions
    if (error.name === 'NotAllowedError') {
      enhancedSolutions.unshift('הרשה גישה למצלמה בדפדפן');
      enhancedSolutions.push('בדוק הגדרות פרטיות של הדפדפן');
    }
    
    if (error.name === 'NotReadableError' || error.name === 'NotFoundError') {
      if (this.devices.length > 1) {
        enhancedSolutions.push('נסה מצלמה אחרת מהרשימה');
      }
      enhancedSolutions.push('סגור יישומים אחרים שעשויים להשתמש במצלמה');
      enhancedSolutions.push('נתק וחבר מחדש מצלמה חיצונית (אם קיימת)');
    }
    
    if (error.name === 'OverconstrainedError') {
      enhancedSolutions.push('המצלמה לא תומכת ברזולוציה המבוקשת');
      enhancedSolutions.push('נסה להשתמש במצלמה אחרת');
    }
    
    return enhancedSolutions;
  }

  /**
   * Categorize error type for better handling
   */
  categorizeError(error) {
    const errorCategories = {
      'NotAllowedError': 'permission',
      'NotFoundError': 'hardware',
      'NotReadableError': 'hardware',
      'OverconstrainedError': 'configuration',
      'SecurityError': 'permission',
      'TypeError': 'browser'
    };
    
    return errorCategories[error.name] || 'unknown';
  }

  /**
   * Check if error can be retried
   */
  canRetryError(error, errorKey) {
    const maxRetries = {
      'permission': 2,
      'hardware': 5,
      'configuration': 3,
      'browser': 1,
      'unknown': 3
    };
    
    const errorType = this.categorizeError(error);
    const attempts = this.errorRecoveryAttempts.get(errorKey) || 0;
    
    return attempts < (maxRetries[errorType] || 3);
  }

  /**
   * Schedule configuration loading
   */
  scheduleConfigLoad(skipIfUserSelecting, respectUserSelections) {
    this.clearConfigLoadTimeout();
    
    this.configLoadTimeout = setTimeout(() => {
      this.loadCameraConfig(skipIfUserSelecting, respectUserSelections);
    }, 1000);
  }

  /**
   * Clear configuration load timeout
   */
  clearConfigLoadTimeout() {
    if (this.configLoadTimeout) {
      clearTimeout(this.configLoadTimeout);
      this.configLoadTimeout = null;
    }
  }

  /**
   * Stop all cameras and cleanup
   */
  stopAllCameras() {
    this.stopInternalCamera();
    this.stopExternalCamera();
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    this.clearConfigLoadTimeout();
    this.stopAllCameras();
    this.retryAttempts.clear();
    this.lastRetryTime = 0;
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
          console.error(`${LOG_PREFIXES.ERROR} Error in camera event listener for ${eventType}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
const cameraService = new CameraService();
export default cameraService;