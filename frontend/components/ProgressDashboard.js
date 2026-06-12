'use client';

import { useState, useEffect, useRef } from 'react';

export default function ProgressDashboard({ keyword, cities, onComplete }) {
  const [status, setStatus] = useState({
    current_city: '',
    current_state: '',
    progress: '0/0',
    total_records: 0,
  });
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const wsRef = useRef(null);
  const logsEndRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const connectWebSocket = () => {
    setConnectionStatus('connecting');
    
    try {
      const ws = new WebSocket(
  process.env.NEXT_PUBLIC_API_URL
    .replace("https://", "wss://")
    .replace("http://", "ws://") +
    "/ws/scrape"
      wsRef.current = ws;

      let connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          handleConnectionError('timeout');
        }
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        setIsConnected(true);
        setConnectionStatus('connected');
        setError(null);
        setRetryCount(0);
        
        addLog('success', '✓ Connected to scraping server');
        
        // Send scraping configuration
        ws.send(JSON.stringify({
          keyword,
          cities,
          max_per_city: 100
        }));
        
        addLog('info', `📋 Starting scrape for "${keyword}" across ${cities.length} cities`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'status') {
            setStatus(data);
          } else if (data.type === 'progress') {
            addLog('info', data.message);
          } else if (data.type === 'city_complete') {
            setStatus(prev => ({
              ...prev,
              total_records: data.total_records
            }));
            addLog('success', `✓ ${data.city}: Found ${data.businesses_found} businesses (Total: ${data.total_records})`);
          } else if (data.type === 'complete') {
            addLog('success', `🎉 Scraping complete! Total: ${data.total_records} businesses`);
            setConnectionStatus('completed');
            onComplete(data);
          } else if (data.type === 'error') {
            handleScrapingError(data.message);
          }
        } catch (err) {
          console.error('Error parsing message:', err);
          addLog('error', 'Failed to parse server message');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        handleConnectionError('error');
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        
        if (connectionStatus !== 'completed') {
          if (event.code === 1000) {
            // Normal closure
            addLog('info', 'Connection closed normally');
          } else {
            addLog('warning', `Connection closed (Code: ${event.code})`);
            handleConnectionError('closed');
          }
        }
      };

    } catch (err) {
      handleConnectionError('failed');
    }
  };

  const handleConnectionError = (errorType) => {
    setConnectionStatus('error');
    
    let errorInfo = {
      type: 'connection',
      message: 'Connection failed',
      details: '',
      suggestion: '',
      canRetry: true
    };

    switch (errorType) {
      case 'timeout':
        errorInfo = {
          type: 'timeout',
          message: 'Connection timeout',
          details: 'Could not connect to the server within 10 seconds',
          suggestion: 'Check if the backend server is running on http://NEXT_PUBLIC_API_URL',
          canRetry: true
        };
        break;
      case 'error':
        errorInfo = {
          type: 'network',
          message: 'Network error',
          details: 'Failed to establish WebSocket connection',
          suggestion: 'Make sure the backend server is running and accessible',
          canRetry: true
        };
        break;
      case 'closed':
        errorInfo = {
          type: 'disconnected',
          message: 'Connection lost',
          details: 'The connection to the server was interrupted',
          suggestion: 'Click retry to reconnect and continue scraping',
          canRetry: true
        };
        break;
      case 'failed':
        errorInfo = {
          type: 'connection',
          message: 'Failed to connect',
          details: 'Could not create WebSocket connection',
          suggestion: 'Verify the backend server is running on port 8000',
          canRetry: true
        };
        break;
    }

    setError(errorInfo);
    addLog('error', `❌ ${errorInfo.message}: ${errorInfo.details}`);
  };

  const handleScrapingError = (message) => {
    const errorInfo = {
      type: 'scraping',
      message: 'Scraping error',
      details: message,
      suggestion: 'The scraper encountered an issue. You can retry or check the logs for details.',
      canRetry: false
    };
    
    setError(errorInfo);
    addLog('error', `❌ ${message}`);
  };

  const addLog = (type, message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { type, message, timestamp }]);
  };

  const handleRetry = () => {
    setError(null);
    setRetryCount(prev => prev + 1);
    addLog('info', `🔄 Retry attempt ${retryCount + 1}...`);
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    setTimeout(() => {
      connectWebSocket();
    }, 1000);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: isPaused ? 'resume' : 'pause'
      }));
    }
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const ErrorAlert = ({ error }) => {
    const iconMap = {
      connection: '🔌',
      timeout: '⏱️',
      network: '🌐',
      disconnected: '⚠️',
      scraping: '🔍'
    };

    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg mb-6 animate-slideIn">
        <div className="flex items-start">
          <div className="text-2xl mr-3">{iconMap[error.type] || '❌'}</div>
          <div className="flex-1">
            <h3 className="text-red-800 font-semibold mb-1">{error.message}</h3>
            <p className="text-red-700 text-sm mb-2">{error.details}</p>
            {error.suggestion && (
              <div className="bg-red-100 border border-red-200 rounded p-2 mt-2">
                <p className="text-red-800 text-sm">
                  💡 <strong>Suggestion:</strong> {error.suggestion}
                </p>
              </div>
            )}
            {error.canRetry && (
              <button
                onClick={handleRetry}
                className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition text-sm font-semibold"
              >
                🔄 Retry Connection
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const ConnectionStatusBadge = () => {
    const statusConfig = {
      connecting: { color: 'yellow', icon: '🔄', text: 'Connecting...', animate: 'animate-pulse' },
      connected: { color: 'green', icon: '✓', text: 'Connected', animate: 'animate-pulse' },
      error: { color: 'red', icon: '✕', text: 'Disconnected', animate: '' },
      completed: { color: 'blue', icon: '✓', text: 'Completed', animate: '' },
    };

    const config = statusConfig[connectionStatus] || statusConfig.connecting;

    return (
      <div className="mb-4 flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 bg-${config.color}-500 ${config.animate}`} />
          <span className="text-sm font-medium text-gray-700">
            {config.icon} {config.text}
          </span>
          {retryCount > 0 && (
            <span className="ml-2 text-xs text-gray-500">
              (Retry #{retryCount})
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {/* Pause/Resume button - implement if needed */}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Scraping in Progress...</h2>

      {/* Error Alert */}
      {error && <ErrorAlert error={error} />}

      {/* Connection Status */}
      <ConnectionStatusBadge />

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
          <p className="text-sm opacity-90 mb-1">Current Location</p>
          <p className="text-2xl font-bold truncate">
            {status.current_city || 'Waiting...'}
          </p>
          <p className="text-sm opacity-90">{status.current_state}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
          <p className="text-sm opacity-90 mb-1">Progress</p>
          <p className="text-2xl font-bold">{status.progress}</p>
          <p className="text-sm opacity-90">Cities Completed</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
          <p className="text-sm opacity-90 mb-1">Total Records</p>
          <p className="text-2xl font-bold">{status.total_records.toLocaleString()}</p>
          <p className="text-sm opacity-90">Businesses Found</p>
        </div>
      </div>

      {/* Live Logs */}
      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg h-96 overflow-y-auto font-mono text-sm">
        <div className="mb-2 text-green-400 flex items-center justify-between sticky top-0 bg-gray-900 pb-2">
          <span>🔍 Scraping Logs:</span>
          <button
            onClick={() => setLogs([])}
            className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-800"
          >
            Clear
          </button>
        </div>
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            Waiting for logs...
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className={`mb-1 ${
                log.type === 'error'
                  ? 'text-red-400'
                  : log.type === 'success'
                  ? 'text-green-400'
                  : log.type === 'warning'
                  ? 'text-yellow-400'
                  : 'text-gray-300'
              }`}
            >
              <span className="text-gray-500 text-xs mr-2">[{log.timestamp}]</span>
              {log.message}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-3 bg-gray-800 text-gray-300 rounded text-xs font-mono">
          <div>WebSocket State: {wsRef.current?.readyState ?? 'null'}</div>
          <div>Connection Status: {connectionStatus}</div>
          <div>Retry Count: {retryCount}</div>
          <div>Total Logs: {logs.length}</div>
        </div>
      )}
    </div>
  );
}
