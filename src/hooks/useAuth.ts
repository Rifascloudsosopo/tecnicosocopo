import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  currentTechnicianId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTechnicianId, setCurrentTechnicianId] = useState<string | null>(null);

  function clearSupabaseAuthStorage() {
    // If the stored session gets corrupted, supabase-js may throw while reading it.
    // Clearing only Supabase keys prevents an infinite "loading" spinner.
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore (e.g., storage disabled)
    }
  }

  async function loadTechnicianIdForUser(userId: string) {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching technician id:', error);
        setCurrentTechnicianId(null);
        return;
      }

      setCurrentTechnicianId(data?.id ?? null);
    } catch (err) {
      console.error('Unexpected error fetching technician id:', err);
      setCurrentTechnicianId(null);
    }
  }

  useEffect(() => {
    let mounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const safeSetLoading = (value: boolean) => {
      if (mounted) setLoading(value);
    };

    const safeSetUserSession = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    };

    // Initialize auth
    const initAuth = async () => {
      try {
        // Set up auth state listener FIRST
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, session) => {
            if (!mounted) return;
            safeSetUserSession(session);
            safeSetLoading(false);

            if (session?.user) {
              // Use setTimeout to avoid blocking and potential race conditions in Chrome
              setTimeout(() => {
                if (mounted) {
                  loadTechnicianIdForUser(session.user.id);
                }
              }, 0);
            } else {
              if (mounted) setCurrentTechnicianId(null);
            }
          }
        );

        authSubscription = subscription;

        // THEN check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        safeSetUserSession(session);
        safeSetLoading(false);

        if (session?.user) {
          loadTechnicianIdForUser(session.user.id);
        } else {
          setCurrentTechnicianId(null);
        }
      } catch (err) {
        console.error('Error loading auth session:', err);
        // Fix common case: corrupt stored session -> infinite spinner
        clearSupabaseAuthStorage();
        if (mounted) {
          safeSetUserSession(null);
          setCurrentTechnicianId(null);
          safeSetLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName }
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    currentTechnicianId
  };
}

export { AuthContext };
