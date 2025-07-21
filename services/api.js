// Dynamically determine API base URL for Expo development
let API_BASE_URL = 'http://192.168.1.173:3001/api'; // fallback default

// Use Expo Constants if available (for development)
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  const Constants = require('expo-constants').default;
  if (Constants?.manifest?.debuggerHost) {
    const debuggerHost = Constants.manifest.debuggerHost.split(':').shift();
    API_BASE_URL = `http://${debuggerHost}:3001/api`;
  }
} catch (e) {
  // Not running in Expo or Constants not available
}

// Optionally, allow override via environment variable (for EAS or production)
if (process.env.BACKEND_API_URL) {
  API_BASE_URL = process.env.BACKEND_API_URL;
}

export { API_BASE_URL };
console.log('[API] Using API_BASE_URL:', API_BASE_URL);

import { io as socketIOClient } from 'socket.io-client';

// Remove /api from API_BASE_URL for socket connection
const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api$/, '');
export const socket = socketIOClient(SOCKET_BASE_URL);

export const apiService = {
  // User login
  login: async ({ serviceId, password }) => {
    const response = await fetch(`${API_BASE_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: serviceId, password }),
    });
    if (!response.ok) throw new Error('Login failed');
    return response.json();
  },

  // User registration (registration request)
  register: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/registration-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      let errorMsg = 'Registration request failed';
      try {
        const err = await response.json();
        if (err && err.error) errorMsg = err.error;
      } catch {}
      throw new Error(errorMsg);
    }
    return response.json();
  },

  // Fetch notifications
  getNotifications: async () => {
    const response = await fetch(`${API_BASE_URL}/notifications`);
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
  },

  // Fetch notifications filtered by unit and level
  getNotificationsByUnitAndLevel: async (unit, level) => {
    const url = `${API_BASE_URL}/notifications?unit=${encodeURIComponent(unit)}&level=${encodeURIComponent(level)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch filtered notifications');
    return response.json();
  },

  // Fetch reports
  getReports: async () => {
    const response = await fetch(`${API_BASE_URL}/reports`);
    if (!response.ok) throw new Error('Failed to fetch reports');
    return response.json();
  },

  // Fetch all users (for Commander Dashboard real-time updates)
  getAllUsers: async () => {
    const response = await fetch(`${API_BASE_URL}/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  // Fetch a single user by username
  getUserByUsername: async (username) => {
    const response = await fetch(`${API_BASE_URL}/users?username=${encodeURIComponent(username)}`);
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  },

  // Fetch all soldiers (for geospatial search)
  getAllSoldiers: async () => {
    const response = await fetch(`${API_BASE_URL}/users?role=soldier`);
    if (!response.ok) throw new Error('Failed to fetch soldiers');
    return response.json();
  },

  // Fetch soldiers by unit
  getSoldiersByUnit: async (unit) => {
    const response = await fetch(`${API_BASE_URL}/users?role=soldier&unit=${encodeURIComponent(unit)}`);
    if (!response.ok) throw new Error('Failed to fetch soldiers by unit');
    return response.json();
  },

  // Fetch active soldiers by unit
  getActiveSoldiersByUnit: async (unit) => {
    const response = await fetch(`${API_BASE_URL}/users?role=soldier&unit=${encodeURIComponent(unit)}&status=active`);
    if (!response.ok) throw new Error('Failed to fetch active soldiers by unit');
    return response.json();
  },

  // Create a new geofence (zone)
  createZone: async (zoneData) => {
    // zoneData: { coordinates: [...], center: { latitude, longitude } }
    const payload = {
      points: zoneData.coordinates,
      center_latitude: zoneData.center.latitude,
      center_longitude: zoneData.center.longitude,
    };
    const response = await fetch(`${API_BASE_URL}/zones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Failed to create zone');
    return response.json();
  },

  // Get all geofences (zones)
  getZones: async () => {
    const response = await fetch(`${API_BASE_URL}/zones`);
    if (!response.ok) throw new Error('Failed to fetch zones');
    return response.json();
  },

  // Fetch tasks for a soldier by userId
  getTasksForSoldier: async (userId) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/tasks`);
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return response.json();
  },

  // Fetch alerts
  getAlerts: async () => {
    const response = await fetch(`${API_BASE_URL}/alerts`);
    if (!response.ok) throw new Error('Failed to fetch alerts');
    return response.json();
  },

  // Add this function to update user location
  updateUserLocation: async (userId, latitude, longitude) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/location`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude }),
    });
    if (!response.ok) throw new Error('Failed to update user location');
    return response.json();
  },
}; 