/* eslint-disable no-console */

class TestService {
  constructor() {
    this.baseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
    this.activeTest = null;
  }

  /**
   * Start an end-to-end test
   * @param {Object} config - Test configuration
   * @returns {Promise<Object>} Test result
   */
  async startEndToEndTest(config) {
    try {
      console.log('🧪 [TestService] Starting end-to-end test with config:', config);
      
      const response = await fetch(`${this.baseUrl}/test/end-to-end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Test start failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      this.activeTest = result.test_id;
      
      console.log('✅ [TestService] Test started successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ [TestService] Failed to start test:', error);
      throw error;
    }
  }

  /**
   * Get test status
   * @param {string} testId - Test ID
   * @returns {Promise<Object>} Test status
   */
  async getTestStatus(testId) {
    try {
      const response = await fetch(`${this.baseUrl}/test/status/${testId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get test status: ${response.status} ${response.statusText}`);
      }
      
      const status = await response.json();
      console.log(`📊 [TestService] Test ${testId} status:`, status);
      return status;
    } catch (error) {
      console.error(`❌ [TestService] Failed to get test status for ${testId}:`, error);
      throw error;
    }
  }

  /**
   * Get test logs
   * @param {string} testId - Test ID
   * @returns {Promise<Object>} Test logs
   */
  async getTestLogs(testId) {
    try {
      const response = await fetch(`${this.baseUrl}/test/logs/${testId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get test logs: ${response.status} ${response.statusText}`);
      }
      
      const logs = await response.json();
      console.log(`📋 [TestService] Retrieved ${logs.log_count} log entries for test ${testId}`);
      return logs;
    } catch (error) {
      console.error(`❌ [TestService] Failed to get test logs for ${testId}:`, error);
      throw error;
    }
  }

  /**
   * Download test logs as a file
   * @param {string} testId - Test ID
   * @returns {Promise<boolean>} Success status
   */
  async downloadTestLogs(testId) {
    try {
      console.log(`💾 [TestService] Downloading logs for test ${testId}`);
      
      const response = await fetch(`${this.baseUrl}/test/download-logs/${testId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to download logs: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test_${testId}_logs.log`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`✅ [TestService] Logs downloaded successfully for test ${testId}`);
      return true;
    } catch (error) {
      console.error(`❌ [TestService] Failed to download logs for ${testId}:`, error);
      throw error;
    }
  }

  /**
   * Check system health
   * @returns {Promise<Object>} Health status
   */
  async checkSystemHealth() {
    try {
      console.log('🏥 [TestService] Checking system health');
      
      const response = await fetch(`${this.baseUrl}/system/health`);
      
      const result = {
        connected: response.ok,
        status: response.status,
        statusText: response.statusText,
        timestamp: new Date().toISOString()
      };

      if (response.ok) {
        try {
          const data = await response.json();
          result.data = data;
          console.log('✅ [TestService] System health check passed:', data);
        } catch (parseError) {
          console.warn('⚠️ [TestService] Health endpoint responded but data not parseable:', parseError);
        }
      } else {
        console.warn(`⚠️ [TestService] System health check failed: ${response.status} ${response.statusText}`);
      }

      return result;
    } catch (error) {
      console.error('❌ [TestService] System health check error:', error);
      return {
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get all active tests
   * @returns {Promise<Object>} Active tests list
   */
  async getActiveTests() {
    try {
      const response = await fetch(`${this.baseUrl}/test/active-tests`);
      
      if (!response.ok) {
        throw new Error(`Failed to get active tests: ${response.status} ${response.statusText}`);
      }
      
      const activeTests = await response.json();
      console.log('📋 [TestService] Active tests:', activeTests);
      return activeTests;
    } catch (error) {
      console.error('❌ [TestService] Failed to get active tests:', error);
      throw error;
    }
  }

  /**
   * Get current active test ID
   * @returns {string|null} Active test ID
   */
  getActiveTestId() {
    return this.activeTest;
  }

  /**
   * Clear active test
   */
  clearActiveTest() {
    this.activeTest = null;
  }

  /**
   * Check if backend is reachable
   * @returns {Promise<boolean>} Reachability status
   */
  async isBackendReachable() {
    try {
      const response = await fetch(`${this.baseUrl}/system/health`, {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test WebSocket connectivity
   * @param {string} endpoint - WebSocket endpoint to test
   * @returns {Promise<Object>} Connection test result
   */
  async testWebSocketConnectivity(endpoint = '/video/live-stream') {
    return new Promise((resolve) => {
      const websocketUrl = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8000';
      const fullUrl = `${websocketUrl}${endpoint}`;
      
      console.log(`🔌 [TestService] Testing WebSocket connectivity to: ${fullUrl}`);
      
      const startTime = Date.now();
      let connected = false;
      
      try {
        const ws = new WebSocket(fullUrl);
        
        const timeout = setTimeout(() => {
          if (!connected) {
            ws.close();
            resolve({
              success: false,
              error: 'Connection timeout',
              duration: Date.now() - startTime,
              endpoint: fullUrl
            });
          }
        }, 10000); // 10 second timeout
        
        ws.onopen = () => {
          connected = true;
          clearTimeout(timeout);
          const duration = Date.now() - startTime;
          
          console.log(`✅ [TestService] WebSocket connected successfully in ${duration}ms`);
          
          ws.close();
          resolve({
            success: true,
            duration,
            endpoint: fullUrl
          });
        };
        
        ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error('❌ [TestService] WebSocket connection error:', error);
          
          resolve({
            success: false,
            error: 'Connection error',
            duration: Date.now() - startTime,
            endpoint: fullUrl
          });
        };
        
        ws.onclose = (event) => {
          if (!connected) {
            clearTimeout(timeout);
            resolve({
              success: false,
              error: `Connection closed immediately: ${event.code} ${event.reason}`,
              duration: Date.now() - startTime,
              endpoint: fullUrl
            });
          }
        };
        
      } catch (error) {
        console.error('❌ [TestService] WebSocket test failed:', error);
        resolve({
          success: false,
          error: error.message,
          duration: Date.now() - startTime,
          endpoint: fullUrl
        });
      }
    });
  }
}

// Export singleton instance
const testService = new TestService();
export default testService;