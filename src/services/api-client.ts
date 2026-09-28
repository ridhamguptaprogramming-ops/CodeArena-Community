import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim() || '';

export const normalizeApiBaseUrl = (value: string) => value
  .trim()
  .replace(/(?:\/submit)+\/*$/i, '')
  .replace(/(?:\/api\/v1){2,}(?=\/|$)/i, '/api/v1')
  .replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL: normalizeApiBaseUrl(configuredBaseUrl),
  // Leave room for the backend's bounded compile and runtime timeouts.
  timeout: 40000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});
