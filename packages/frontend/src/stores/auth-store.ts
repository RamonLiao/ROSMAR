import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  userAddress: string | null;
  login: (address: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userAddress: null,
      login: (address) => set({ isAuthenticated: true, userAddress: address }),
      logout: () => set({ isAuthenticated: false, userAddress: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
