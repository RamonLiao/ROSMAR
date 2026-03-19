import '@testing-library/jest-dom';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import { vi } from 'vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Sui wallet hooks
vi.mock('@mysten/dapp-kit', () => ({
  ConnectButton: vi.fn(({ className: _className }: { className?: string }) => null),
  ConnectModal: vi.fn(({ children }: { children?: any }) => children ?? null),
  useCurrentAccount: () => null,
  useConnectWallet: () => ({ mutateAsync: vi.fn() }),
  useDisconnectWallet: () => ({ mutateAsync: vi.fn() }),
  useSignPersonalMessage: () => ({ mutateAsync: vi.fn() }),
  useWallets: () => [],
}));

// Mock Enoki
vi.mock('@mysten/enoki', () => ({
  isEnokiWallet: () => false,
}));

// Mock framer-motion — render motion.* as plain HTML elements
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  const handler = {
    get(_: unknown, prop: string) {
      return ({ children, ...props }: any) => {
        const { variants, initial, animate, exit, whileHover, whileTap, transition, layout, ...rest } = props;
        const tag = prop === 'div' ? 'div' : prop === 'span' ? 'span' : prop === 'ul' ? 'ul' : prop === 'li' ? 'li' : 'div';
        const el = document.createElement(tag);
        return require('react').createElement(tag, rest, children);
      };
    },
  };
  return {
    ...actual,
    motion: new Proxy({}, handler),
    AnimatePresence: ({ children }: any) => children,
  };
});
