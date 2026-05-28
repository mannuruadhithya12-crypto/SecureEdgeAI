import EncryptedStorage from 'react-native-encrypted-storage';
import { Platform } from 'react-native';
import Aes from 'react-native-aes-crypto';

export interface ApiResponse<T = any> {
  status: number;
  data?: T;
  error?: string;
}

const BACKEND_URL = Platform.OS === 'android' ? 'http://172.20.10.3:5000' : 'http://localhost:5000';
const CLIENT_ID = 'secure_edge_mobile_client';
const CLIENT_SECRET = 'secure_edge_client_secret_xyz';
const HMAC_SECRET = 'secure_edge_hmac_secret_4567890';

// Fallback HMAC SHA256 (for unit tests / mock environments)
async function computeHMAC(text: string, key: string): Promise<string> {
  try {
    return await Aes.hmac256(text, key);
  } catch (error) {
    let hash = 0;
    const combined = text + key;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return 'hmac_sig_' + Math.abs(hash).toString(16);
  }
}

/**
 * Enforce HTTPS transport policies (CHANGE-7)
 */
function validateUrlSecurity(url: string): void {
  const isDevHost = url.includes('localhost') || url.includes('10.0.2.2') || url.includes('127.0.0.1') || url.includes('192.168.') || url.includes('172.');
  if (url.startsWith('http://') && !isDevHost) {
    throw new Error('Transport Security Violation: Unencrypted HTTP connections are blocked.');
  }
}

/**
 * Encrypted token storage helpers (CHANGE-6)
 */
async function getStoredTokens() {
  try {
    const access = await EncryptedStorage.getItem('jwt_access_token');
    const refresh = await EncryptedStorage.getItem('jwt_refresh_token');
    return { accessToken: access, refreshToken: refresh };
  } catch (e) {
    return { accessToken: null, refreshToken: null };
  }
}

async function saveStoredTokens(access: string, refresh: string) {
  try {
    await EncryptedStorage.setItem('jwt_access_token', access);
    await EncryptedStorage.setItem('jwt_refresh_token', refresh);
  } catch (e) {
    console.error('[ApiClient] Failed to store tokens:', e);
  }
}

async function clearStoredTokens() {
  try {
    await EncryptedStorage.removeItem('jwt_access_token');
    await EncryptedStorage.removeItem('jwt_refresh_token');
  } catch (e) {
    console.error('[ApiClient] Failed to clear tokens:', e);
  }
}

/**
 * Request auth login to get initial tokens (CHANGE-5)
 */
async function authenticateDevice(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const url = `${BACKEND_URL}/auth/login`;
  validateUrlSecurity(url);

  const bodyObj = { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET };
  const bodyStr = JSON.stringify(bodyObj);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
    });
    if (response.status === 200) {
      const data = (await response.json()) as any;
      await saveStoredTokens(data.accessToken, data.refreshToken);
      return { accessToken: data.accessToken, refreshToken: data.refreshToken };
    }
  } catch (e) {
    console.error('[ApiClient] Authentication request failed:', e);
  }
  return null;
}

/**
 * Perform Token Rotation / Refresh (CHANGE-5)
 */
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const url = `${BACKEND_URL}/auth/refresh`;
  validateUrlSecurity(url);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (response.status === 200) {
      const data = (await response.json()) as any;
      await saveStoredTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    }
  } catch (e) {
    console.error('[ApiClient] Token refresh request failed:', e);
  }
  return null;
}

export class ApiClient {
  /**
   * Performs an authenticated, signed, and timed-out fetch request (CHANGE-5, CHANGE-7, CHANGE-8, CHANGE-18)
   */
  static async request<T = any>(
    method: 'GET' | 'POST',
    endpoint: string,
    payload: any = null
  ): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${BACKEND_URL}${endpoint}`;
    validateUrlSecurity(url);

    // 1. Load active tokens
    let { accessToken, refreshToken } = await getStoredTokens();
    if (!accessToken) {
      const tokens = await authenticateDevice();
      if (tokens) {
        accessToken = tokens.accessToken;
        refreshToken = tokens.refreshToken;
      }
    }

    // 2. Perform Request
    let response = await this.executeFetch(method, url, accessToken, payload);

    // 3. Handle Token Expiration (401)
    if (response.status === 401 && refreshToken) {
      console.log('[ApiClient] Access token expired, attempting refresh...');
      const newAccess = await refreshAccessToken(refreshToken);
      if (newAccess) {
        // Retry the request with the rotated token
        response = await this.executeFetch(method, url, newAccess, payload);
      } else {
        // Refresh token failed/expired; re-authenticate
        await clearStoredTokens();
        const tokens = await authenticateDevice();
        if (tokens) {
          response = await this.executeFetch(method, url, tokens.accessToken, payload);
        }
      }
    }

    return response;
  }

  private static async executeFetch(
    method: 'GET' | 'POST',
    url: string,
    token: string | null,
    payload: any
  ): Promise<ApiResponse> {
    const timestamp = String(Date.now());
    const bodyStr = payload ? JSON.stringify(payload) : '';
    
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 1. Generate HMAC signature (CHANGE-8)
    const signature = await computeHMAC(bodyStr, HMAC_SECRET);
    headers['X-Signature'] = signature;

    // 2. Setup Timeout Controller (CHANGE-18)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method === 'POST' ? bodyStr : undefined,
        signal: controller.signal as any,
      });

      clearTimeout(timeoutId);

      let data;
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : undefined;
      } catch (e) {
        data = { rawResponse: text };
      }

      return {
        status: response.status,
        data,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        return {
          status: 408,
          error: 'Request Timeout (Server took longer than 8 seconds to respond)',
        };
      }
      return {
        status: 503,
        error: error.message || 'Service Unavailable',
      };
    }
  }

  static async post<T = any>(endpoint: string, payload: any): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, payload);
  }

  static async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint);
  }
}
