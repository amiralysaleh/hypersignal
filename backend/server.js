const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('faye-websocket');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Store WebSocket clients
const clients = new Set();

// Upgrade HTTP connection to WebSocket
server.on('upgrade', function(request, socket, body) {
  if (WebSocket.isWebSocket(request)) {
    const ws = new WebSocket(request, socket, body);
    
    console.log('New WebSocket client connected');
    clients.add(ws);
    
    // Send initial data to the new client
    sendDashboardDataToClient(ws);
    
    ws.on('close', function(event) {
      console.log('WebSocket client disconnected:', event.code, event.reason);
      clients.delete(ws);
    });
    
    ws.on('error', function(error) {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  }
});

// Broadcast data to all connected clients
function broadcastToClients(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Error sending to client:', error);
        clients.delete(client);
      }
    }
  });
}

// Send dashboard data to a specific client
async function sendDashboardDataToClient(client) {
  try {
    const dashboardData = await getDashboardData();
    const message = JSON.stringify({
      type: 'dashboard_update',
      data: dashboardData
    });
    
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  } catch (error) {
    console.error('Error sending dashboard data:', error);
  }
}

// Import the signal detection and price update functions
const { detectAndSaveSignals, updateSignalPrices, getSignals } = require('./signal-worker');
const { getDashboardData } = require('./dashboard-data');
const { getSettings, saveSettings } = require('./settings-manager');

// API Routes
app.get('/api/dashboard', async (req, res) => {
  try {
    const data = await getDashboardData();
    res.json(data);
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

app.get('/api/signals', async (req, res) => {
  try {
    const signals = await getSignals();
    res.json(signals);
  } catch (error) {
    console.error('Error getting signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    await saveSettings(req.body);
    res.json({ success: true });
    
    // Broadcast settings update to all clients
    broadcastToClients({
      type: 'settings_update',
      data: req.body
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    clients: clients.size
  });
});

// Worker process management
let isProcessingSignals = false;
let isUpdatingPrices = false;

async function runSignalDetection() {
  if (isProcessingSignals) {
    console.log('Signal detection already in progress, skipping...');
    return;
  }
  
  try {
    isProcessingSignals = true;
    console.log('Starting signal detection process...');
    await detectAndSaveSignals();
    
    // Broadcast updated dashboard data after signal detection
    const dashboardData = await getDashboardData();
    broadcastToClients({
      type: 'dashboard_update',
      data: dashboardData
    });
    
    console.log('Signal detection completed');
  } catch (error) {
    console.error('Error in signal detection:', error);
  } finally {
    isProcessingSignals = false;
  }
}

async function runPriceUpdates() {
  if (isUpdatingPrices) {
    console.log('Price update already in progress, skipping...');
    return;
  }
  
  try {
    isUpdatingPrices = true;
    console.log('Starting price update process...');
    await updateSignalPrices();
    
    // Broadcast updated dashboard data after price updates
    const dashboardData = await getDashboardData();
    broadcastToClients({
      type: 'dashboard_update',
      data: dashboardData
    });
    
    console.log('Price update completed');
  } catch (error) {
    console.error('Error in price update:', error);
  } finally {
    isUpdatingPrices = false;
  }
}

// Initialize intervals based on settings
let signalInterval;
let priceInterval;

async function initializeIntervals() {
  const settings = await getSettings();
  
  // Clear existing intervals
  if (signalInterval) clearInterval(signalInterval);
  if (priceInterval) clearInterval(priceInterval);
  
  // Set up signal detection interval (convert minutes to milliseconds)
  const signalIntervalMs = (settings.walletPollInterval || 60) * 1000;
  signalInterval = setInterval(runSignalDetection, signalIntervalMs);
  
  // Set up price update interval (convert seconds to milliseconds)  
  const priceIntervalMs = (settings.pricePollInterval || 30) * 1000;
  priceInterval = setInterval(runPriceUpdates, priceIntervalMs);
  
  console.log(`Signal detection interval set to ${signalIntervalMs}ms`);
  console.log(`Price update interval set to ${priceIntervalMs}ms`);
  
  // Run initial processes
  setTimeout(runSignalDetection, 5000); // Start after 5 seconds
  setTimeout(runPriceUpdates, 2000);   // Start after 2 seconds
}

// Start the server
const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
  
  // Initialize worker intervals
  await initializeIntervals();
  
  console.log('Backend service fully initialized and ready for 24/7 operation');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal. Shutting down gracefully...');
  
  // Clear intervals
  if (signalInterval) clearInterval(signalInterval);
  if (priceInterval) clearInterval(priceInterval);
  
  // Close all WebSocket connections
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT signal. Shutting down gracefully...');
  process.emit('SIGTERM');
});