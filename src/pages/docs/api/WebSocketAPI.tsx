export default function DocsWebSocketAPI() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">WebSocket Events</h1>
                <p className="text-lg text-gray-600">
                    Real-time event subscriptions for trades, prices, and venue updates.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Connection</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`const ws = new WebSocket('ws://localhost:4000/ws');

ws.onopen = () => {
  console.log('Connected to Relay Core WebSocket');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleEvent(data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from WebSocket');
};`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Event Types</h2>

                <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">trade.created</h3>
                        <p className="text-sm text-gray-600 mb-3">Emitted when a new trade is executed</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                            <code className="text-gray-800">{`{
  "event": "trade.created",
  "data": {
    "id": "trade_123",
    "pair": "BTC-USD",
    "side": "long",
    "leverage": 5,
    "sizeUsd": 1000,
    "entryPrice": 45234.50,
    "venue": "Moonlander",
    "timestamp": "2026-01-12T03:30:00Z"
  }
}`}</code>
                        </pre>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">trade.updated</h3>
                        <p className="text-sm text-gray-600 mb-3">Emitted when trade status changes</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                            <code className="text-gray-800">{`{
  "event": "trade.updated",
  "data": {
    "id": "trade_123",
    "status": "closed",
    "exitPrice": 46500.00,
    "pnl": 126.50,
    "timestamp": "2026-01-12T04:00:00Z"
  }
}`}</code>
                        </pre>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">price.update</h3>
                        <p className="text-sm text-gray-600 mb-3">Real-time price updates for trading pairs</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                            <code className="text-gray-800">{`{
  "event": "price.update",
  "data": {
    "pair": "BTC-USD",
    "price": 45234.50,
    "change24h": 2.5,
    "volume24h": 1234567890,
    "timestamp": "2026-01-12T03:30:00Z"
  }
}`}</code>
                        </pre>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">venue.reputation.updated</h3>
                        <p className="text-sm text-gray-600 mb-3">Venue reputation score changes</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                            <code className="text-gray-800">{`{
  "event": "venue.reputation.updated",
  "data": {
    "venueId": "moonlander",
    "name": "Moonlander",
    "reputation": {
      "score": 95.5,
      "totalTrades": 1234,
      "successRate": 98.2,
      "avgLatency": 1200,
      "avgSlippage": 0.15
    },
    "timestamp": "2026-01-12T03:30:00Z"
  }
}`}</code>
                        </pre>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">agent.feedback.submitted</h3>
                        <p className="text-sm text-gray-600 mb-3">New feedback submitted for an agent</p>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                            <code className="text-gray-800">{`{
  "event": "agent.feedback.submitted",
  "data": {
    "agentId": "1",
    "score": 92,
    "submitter": "0x...",
    "metadata": "Excellent execution",
    "timestamp": "2026-01-12T03:30:00Z"
  }
}`}</code>
                        </pre>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Subscribing to Events</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`// Subscribe to specific events
ws.send(JSON.stringify({
  action: 'subscribe',
  events: ['trade.created', 'price.update']
}));

// Subscribe to all events
ws.send(JSON.stringify({
  action: 'subscribe',
  events: ['*']
}));

// Unsubscribe from events
ws.send(JSON.stringify({
  action: 'unsubscribe',
  events: ['price.update']
}));`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Event Handler Example</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`function handleEvent(message) {
  switch (message.event) {
    case 'trade.created':
      console.log('New trade:', message.data);
      updateTradesList(message.data);
      break;
      
    case 'price.update':
      console.log('Price update:', message.data);
      updatePriceDisplay(message.data);
      break;
      
    case 'venue.reputation.updated':
      console.log('Venue reputation updated:', message.data);
      updateVenueCard(message.data);
      break;
      
    case 'agent.feedback.submitted':
      console.log('New feedback:', message.data);
      refreshAgentReputation(message.data.agentId);
      break;
      
    default:
      console.log('Unknown event:', message.event);
  }
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">React Hook Example</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`import { useEffect, useState } from 'react';

export function useWebSocket(events: string[]) {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4000/ws');

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({
        action: 'subscribe',
        events
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setData(message);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [events]);

  return { data, connected };
}

// Usage
function TradeMonitor() {
  const { data, connected } = useWebSocket(['trade.created', 'trade.updated']);

  return (
    <div>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Heartbeat</h2>
                <p className="text-gray-700">Keep connection alive with periodic pings:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`// Server sends ping every 30 seconds
{
  "event": "ping",
  "timestamp": "2026-01-12T03:30:00Z"
}

// Client responds with pong
ws.send(JSON.stringify({
  action: 'pong',
  timestamp: Date.now()
}));`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Error Handling</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  
  // Attempt reconnection
  setTimeout(() => {
    connectWebSocket();
  }, 5000);
};

// Handle connection close
ws.onclose = (event) => {
  if (event.wasClean) {
    console.log('Connection closed cleanly');
  } else {
    console.error('Connection died');
    // Attempt reconnection
    setTimeout(() => {
      connectWebSocket();
    }, 5000);
  }
};`}</code>
                </pre>
            </div>
        </div>
    );
}
