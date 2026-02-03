import { Session, User } from '@supabase/supabase-js';
import { offlineStorage } from '@/lib/offlineStorage';

const AUTH_SESSION_KEY = 'offline_auth_session';
const AUTH_USER_KEY = 'offline_auth_user';

interface StoredSession {
  session: Session;
  user: User;
  savedAt: number;
}

// Session valid for 7 days offline
const SESSION_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Save session to IndexedDB for offline access
 */
export async function saveSessionOffline(session: Session, user: User): Promise<void> {
  try {
    await offlineStorage.init();
    const storedSession: StoredSession = {
      session,
      user,
      savedAt: Date.now(),
    };
    
    // Store in IndexedDB as a special record
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(storedSession));
  } catch (error) {
    console.error('Error saving session offline:', error);
  }
}

/**
 * Get saved session from IndexedDB
 */
export function getOfflineSession(): StoredSession | null {
  try {
    const stored = localStorage.getItem(AUTH_SESSION_KEY);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored) as StoredSession;
    
    // Check if session is still valid (within 7 days)
    if (Date.now() - parsed.savedAt > SESSION_VALIDITY_MS) {
      clearOfflineSession();
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('Error getting offline session:', error);
    return null;
  }
}

/**
 * Check if there's a valid offline session
 */
export function hasValidOfflineSession(): boolean {
  return getOfflineSession() !== null;
}

/**
 * Clear offline session
 */
export function clearOfflineSession(): void {
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch (error) {
    console.error('Error clearing offline session:', error);
  }
}

/**
 * Get technician ID from cached data
 */
export async function getOfflineTechnicianId(userId: string): Promise<string | null> {
  try {
    await offlineStorage.init();
    const technicians = await offlineStorage.getAll<{ id: string; user_id: string }>('technicians');
    const technician = technicians.find(t => t.user_id === userId);
    return technician?.id || null;
  } catch (error) {
    console.error('Error getting offline technician id:', error);
    return null;
  }
}
