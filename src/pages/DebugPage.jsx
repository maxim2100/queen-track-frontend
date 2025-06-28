import React, { useState, useEffect, useCallback } from 'react';

const DebugPage = () => {
  const [websocketStatus, setWebsocketStatus] = useState({});
  const [backendTest, setBackendTest] = useState(null);

  const websocketUrl = process.env.REACT_APP_WEBSOCKET_URL;
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  // Test backend connectivity
  const testBackendConnection = useCallback(async () => {
    setBackendTest('testing...');
    try {
      const response = await fetch(`${backendUrl}/health`);
      const data = await response.text();
      setBackendTest({
        status: 'success',
        response: data,
        statusCode: response.status
      });
    } catch (error) {
      setBackendTest({
        status: 'error',
        error: error.message
      });
    }
  }, [backendUrl]);

  // Test WebSocket connections
  const testWebSocket = useCallback((endpoint, name) => {
    const fullUrl = `${websocketUrl}${endpoint}`;
    // eslint-disable-next-line no-console
    console.log(`Testing WebSocket: ${name} -> ${fullUrl}`);
    
    const ws = new WebSocket(fullUrl);
    const startTime = Date.now();
    
    const updateStatus = (status, details = {}) => {
      setWebsocketStatus(prev => ({
        ...prev,
        [name]: {
          url: fullUrl,
          status,
          duration: Date.now() - startTime,
          ...details
        }
      }));
    };

    ws.onopen = () => {
      // eslint-disable-next-line no-console
      console.log(`✅ ${name} WebSocket opened`);
      updateStatus('connected');
      
      // Close after successful connection test
      setTimeout(() => ws.close(), 1000);
    };

    ws.onclose = (event) => {
      // eslint-disable-next-line no-console
      console.log(`❌ ${name} WebSocket closed:`, event);
      updateStatus('closed', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
    };

    ws.onerror = (error) => {
      // eslint-disable-next-line no-console
      console.error(`💥 ${name} WebSocket error:`, error);
      updateStatus('error', { error: error.type });
    };
  }, [websocketUrl]);

  const runAllTests = useCallback(() => {
    setWebsocketStatus({});
    
    testBackendConnection();
    testWebSocket('/video/live-stream', 'Live Stream');
    testWebSocket('/video/notifications', 'Notifications');
  }, [websocketUrl, backendUrl, testBackendConnection, testWebSocket]);

  useEffect(() => {
    runAllTests();
  }, [runAllTests]);

  const debugStyle = {
    padding: '20px',
    fontFamily: 'monospace',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
    direction: 'ltr'
  };

  const sectionStyle = {
    backgroundColor: 'white',
    margin: '20px 0',
    padding: '15px',
    borderRadius: '5px',
    border: '1px solid #ddd'
  };

  const statusStyle = (status) => ({
    color: status === 'connected' ? 'green' : 
           status === 'error' ? 'red' : 
           status === 'closed' ? 'orange' : 'blue',
    fontWeight: 'bold'
  });

  return (
    <div style={debugStyle}>
      <h1>🔧 Debug Information</h1>
      
      <div style={sectionStyle}>
        <h2>Environment Variables</h2>
        <pre>{JSON.stringify({
          REACT_APP_WEBSOCKET_URL: process.env.REACT_APP_WEBSOCKET_URL,
          REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL,
          NODE_ENV: process.env.NODE_ENV,
          REACT_APP_VERSION: process.env.REACT_APP_VERSION || 'not set'
        }, null, 2)}</pre>
      </div>

      <div style={sectionStyle}>
        <h2>Constructed URLs</h2>
        <pre>{JSON.stringify({
          backendUrl,
          websocketUrl,
          liveStreamUrl: `${websocketUrl}/video/live-stream`,
          notificationsUrl: `${websocketUrl}/video/notifications`,
          healthUrl: `${backendUrl}/health`
        }, null, 2)}</pre>
      </div>

      <div style={sectionStyle}>
        <h2>Backend Connection Test</h2>
        <button onClick={testBackendConnection} style={{marginBottom: '10px'}}>
          Test Backend Connection
        </button>
        {backendTest && (
          <pre>{JSON.stringify(backendTest, null, 2)}</pre>
        )}
      </div>

      <div style={sectionStyle}>
        <h2>WebSocket Connection Tests</h2>
        <button onClick={runAllTests} style={{marginBottom: '10px'}}>
          Run All WebSocket Tests
        </button>
        
        {Object.entries(websocketStatus).map(([name, status]) => (
          <div key={name} style={{margin: '10px 0', padding: '10px', border: '1px solid #eee'}}>
            <h3>{name}</h3>
            <div>URL: {status.url}</div>
            <div>Status: <span style={statusStyle(status.status)}>{status.status}</span></div>
            <div>Duration: {status.duration}ms</div>
            {status.code && <div>Close Code: {status.code}</div>}
            {status.reason && <div>Close Reason: {status.reason}</div>}
            {status.error && <div>Error: {status.error}</div>}
          </div>
        ))}
      </div>

      <div style={sectionStyle}>
        <h2>Browser Information</h2>
        <pre>{JSON.stringify({
          userAgent: navigator.userAgent,
          location: {
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            port: window.location.port,
            pathname: window.location.pathname
          },
          webSocketSupported: !!window.WebSocket,
          origin: window.location.origin
        }, null, 2)}</pre>
      </div>

      <div style={sectionStyle}>
        <h2>Console Logs</h2>
        <p>Check the browser console for detailed WebSocket debugging logs.</p>
        <p>All WebSocket events are now logged with detailed information.</p>
      </div>
    </div>
  );
};

export default DebugPage; 