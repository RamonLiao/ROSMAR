import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  userAddress: string | null;
  jwt: string | null;
  login: (address: string, jwt?: string) => void;
  logout: () => void;
  setJwt: (jwt: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userAddress: null,
      jwt: null,
      login: (address, jwt) => set({ isAuthenticated: true, userAddress: address, jwt: jwt || null }),
      logout: () => set({ isAuthenticated: false, userAddress: null, jwt: null }),
      setJwt: (jwt) => set({ jwt }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
