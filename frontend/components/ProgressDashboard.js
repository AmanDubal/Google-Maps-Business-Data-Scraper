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
  const wsRef = useRef(null);

  useEffect(() => {
    // Connect to WebSocket
    const ws = new WebSocket(
  process.env.NEXT_PUBLIC_API_URL
    .replace("https://", "wss://")
    .replace("http://", "ws://") +
    "/ws/scrape"
);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // Send scraping configuration
      ws.send(JSON.stringify({
        keyword,
        cities,
        max_per_city: 100
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'status') {
        setStatus(data);
      } else if (data.type === 'progress') {
        setLogs((prev) => [...prev, { type: 'info', message: data.message }]);
      } else if (data.type === 'city_complete') {
        setLogs((prev) => [
          ...prev,
          {
            type: 'success',
            message: `✓ ${data.city}: Found ${data.businesses_found} businesses`
          }
        ]);
      } else if (data.type === 'complete') {
        setLogs((prev) => [
          ...prev,
          {
            type: 'success',
            message: `🎉 Scraping complete! Total records: ${data.total_records}`
          }
        ]);
        onComplete(data);
      } else if (data.type === 'error') {
        setLogs((prev) => [...prev, { type: 'error', message: data.message }]);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setLogs((prev) => [...prev, { type: 'error', message: 'Connection error' }]);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [keyword, cities, onComplete]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Scraping in Progress...</h2>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
          <p className="text-sm opacity-90 mb-1">Current Location</p>
          <p className="text-2xl font-bold">
            {status.current_city || 'Starting...'}
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
          <p className="text-2xl font-bold">{status.total_records}</p>
          <p className="text-sm opacity-90">Businesses Found</p>
        </div>
      </div>

      {/* Connection Status */}
      <div className="mb-4 flex items-center">
        <div
          className={`w-3 h-3 rounded-full mr-2 ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}
        />
        <span className="text-sm text-gray-600">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Live Logs */}
      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg h-96 overflow-y-auto font-mono text-sm">
        <div className="mb-2 text-green-400">🔍 Scraping Logs:</div>
        {logs.map((log, index) => (
          <div
            key={index}
            className={`mb-1 ${
              log.type === 'error'
                ? 'text-red-400'
                : log.type === 'success'
                ? 'text-green-400'
                : 'text-gray-300'
            }`}
          >
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
