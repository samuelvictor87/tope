import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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

    // Timeout de segurança: garante que a tela saia de loading em no máximo 3 segundos
    const timeoutId = setTimeout(() => {
      if (active) {
        console.warn('Auth fallback timeout triggered');
        setLoading(false);
      }
    }, 3000);

    // Escuta unificada para mudanças no estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;

        if (session) {
          setUser(session.user);
          // Busca o perfil de forma assíncrona fora do loop de bloqueio do Supabase
          setTimeout(async () => {
            if (!active) return;
            const prof = await fetchProfile(session.user.id);
            if (active) {
              setProfile(prof);
              setLoading(false);
            }
          }, 0);
        } else {
          setUser(null);
          setProfile(null);
          if (active) {
            setLoading(false);
          }
        }
      }
    );

    return () => {
      active = false;
      clearTimeout(timeoutId);
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
