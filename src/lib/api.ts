// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export const API_ENDPOINTS = {
  dashboard: `${API_BASE_URL}/dashboard`,
  signals: `${API_BASE_URL}/signals`,
  settings: `${API_BASE_URL}/settings`,
  health: `${API_BASE_URL}/health`,
};

export const WEBSOCKET_URL = WS_BASE_URL;

// API service functions
export async function fetchDashboardData() {
  const response = await fetch(API_ENDPOINTS.dashboard);
  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchSignals() {
  const response = await fetch(API_ENDPOINTS.signals);
  if (!response.ok) {
    throw new Error(`Failed to fetch signals: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchSettings() {
  const response = await fetch(API_ENDPOINTS.settings);
  if (!response.ok) {
    throw new Error(`Failed to fetch settings: ${response.statusText}`);
  }
  return response.json();
}

export async function updateSettings(settings: any) {
  const response = await fetch(API_ENDPOINTS.settings, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    throw new Error(`Failed to update settings: ${response.statusText}`);
  }
  return response.json();
}

export async function checkHealth() {
  const response = await fetch(API_ENDPOINTS.health);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return response.json();
}