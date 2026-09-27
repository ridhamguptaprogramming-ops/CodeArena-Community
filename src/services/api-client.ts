import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim() || '';

export const normalizeApiBaseUrl = (value: string) => value
  .replace(/(?:\/submit)+\/*$/i, '')
  .replace(/\/(?:api\/v1)(?:\/api\/v1)+(?=\/|$)/i, '/api/v1')
  .replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL: normalizeApiBaseUrl(configuredBaseUrl),
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});
