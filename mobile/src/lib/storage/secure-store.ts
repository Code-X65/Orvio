import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY_ACCESS_TOKEN = 'orvio_access_token';
const KEY_REFRESH_TOKEN = 'orvio_refresh_token';
const KEY_USER_SESSION = 'orvio_user_session';
const KEY_ACTIVE_SUBDOMAIN = 'orvio_active_subdomain';

// In-memory fallback for web preview or storage failure
const memoryStorage: Record<string, string> = {};

export async function saveSecureItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      } else {
        memoryStorage[key] = value;
      }
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  } catch {
    memoryStorage[key] = value;
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(key);
      }
      return memoryStorage[key] || null;
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return memoryStorage[key] || null;
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
      delete memoryStorage[key];
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    delete memoryStorage[key];
  }
}

export const StorageKeys = {
  ACCESS_TOKEN: KEY_ACCESS_TOKEN,
  REFRESH_TOKEN: KEY_REFRESH_TOKEN,
  USER_SESSION: KEY_USER_SESSION,
  ACTIVE_SUBDOMAIN: KEY_ACTIVE_SUBDOMAIN,
};
