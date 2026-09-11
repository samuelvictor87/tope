import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { AUTH_FETCH_TIMEOUT_MS, supabase } from '../lib/supabase';
import { isNetworkAuthError } from '../lib/authErrors';

export interface Profile {
  id: string;
  usuario_id: string;
  nome_completo: string;
  email: string;
  whatsapp: string | null;
  perfil: 'administrador' | 'vendedor' | 'fornecedor';
  avatar_url: string | null;
  criado_em: string;
  atualizado_em: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('usuario_id', userId)
        .single();
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data as Profile;
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const prof = await fetchProfile(user.id);
      setProfile(prof);
    }
  };

  useEffect(() => {
    let active = true;
    let fallbackTimeoutId: ReturnType<typeof setTimeout>;

    const clearFallbackTimeout = () => {
      clearTimeout(fallbackTimeoutId);
    };

    const loadProfile = (userId: string) => {
      void fetchProfile(userId).then((prof) => {
        if (active) setProfile(prof);
      });
    };

    const resolveAuth = (session: Session | null) => {
      if (!active) return;
      clearFallbackTimeout();

      if (session?.user) {
        setUser(session.user);
        setLoading(false);
        loadProfile(session.user.id);
        return;
      }

      setUser(null);
      setProfile(null);
      setLoading(false);
    };

    const handleAuthError = async (error: unknown) => {
      if (!active) return;
      clearFallbackTimeout();

      if (isNetworkAuthError(error)) {
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          // Ignora falha ao limpar sessão local
        }
      }

      setUser(null);
      setProfile(null);
      setLoading(false);
    };

    fallbackTimeoutId = setTimeout(() => {
      if (active) setLoading(false);
    }, AUTH_FETCH_TIMEOUT_MS + 1000);

    void supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!active) return;
        if (error) {
          void handleAuthError(error);
          return;
        }
        resolveAuth(session);
      })
      .catch((error) => {
        void handleAuthError(error);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        resolveAuth(session);
      }
    );

    return () => {
      active = false;
      clearFallbackTimeout();
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error in supabase.auth.signOut:', err);
    } finally {
      setUser(null);
      setProfile(null);
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.error('Error clearing localStorage keys:', e);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
