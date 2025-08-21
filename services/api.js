import { io as socketIOClient } from 'socket.io-client';
import Constants from 'expo-constants';

// ✅ Set API base URL from env or fallback to localhost (for dev)
let API_BASE_URL = Constants.expoConfig?.extra?.BACKEND_API_URL || 'u';

console.log('[API] Using API_BASE_URL:', API_BASE_URL);

// ✅ Derive socket base URL (remove trailing "/api")
const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api$/, '');
export const socket = socketIOClient(SOCKET_BASE_URL, {
  transports: ['websocket'],
});

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

  // User registration
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
        if (err?.error) errorMsg = err.error;
      } catch {}
      throw new Error(errorMsg);
    }
    return response.json();
  },

  getNotifications: async () => {
    const response = await fetch(`${API_BASE_URL}/notifications`);
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
  },

  getNotificationsByUnitAndLevel: async (unit, level) => {
    const url = `${API_BASE_URL}/notifications?unit=${encodeURIComponent(unit)}&level=${encodeURIComponent(level)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch filtered notifications');
    return response.json();
  },

  getReports: async () => {
    const response = await fetch(`${API_BASE_URL}/reports`);
    if (!response.ok) throw new Error('Failed to fetch reports');
    return response.json();
  },

  getAllUsers: async () => {
    const response = await fetch(`${API_BASE_URL}/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  getUserByUsername: async (username) => {
    const response = await fetch(`${API_BASE_URL}/users?username=${encodeURIComponent(username)}`);
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  },

  getAllSoldiers: async () => {
    const response = await fetch(`${API_BASE_URL}/users?role=soldier`);
    if (!response.ok) throw new Error('Failed to fetch soldiers');
    return response.json();
  },

  getSoldiersByUnit: async (unit) => {
    const response = await fetch(`${API_BASE_URL}/users?role=soldier&unit=${encodeURIComponent(unit)}`);
    if (!response.ok) throw new Error('Failed to fetch soldiers by unit');
    return response.json();
  },

  getActiveSoldiersByUnit: async (unit) => {
    const response = await fetch(`${API_BASE_URL}/users?role=soldier&unit=${encodeURIComponent(unit)}&status=active`);
    if (!response.ok) throw new Error('Failed to fetch active soldiers by unit');
    return response.json();
  },

  createZone: async (zoneData) => {
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

  getZones: async () => {
    const response = await fetch(`${API_BASE_URL}/zones`);
    if (!response.ok) throw new Error('Failed to fetch zones');
    return response.json();
  },

  getTasksForSoldier: async (userId) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/tasks`);
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return response.json();
  },

  getAlerts: async () => {
    const response = await fetch(`${API_BASE_URL}/alerts`);
    if (!response.ok) throw new Error('Failed to fetch alerts');
    return response.json();
  },

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
