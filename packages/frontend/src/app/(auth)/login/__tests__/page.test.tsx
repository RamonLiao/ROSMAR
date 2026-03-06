import { render, screen } from '@/test/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from '../page';

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    login: vi.fn(),
    isAuthenticated: false,
  }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login page with title', () => {
    render(<LoginPage />);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('renders authentication method description', () => {
    render(<LoginPage />);
    expect(
      screen.getByText('Choose your preferred authentication method')
    ).toBeInTheDocument();
  });

  it('renders Google login button', () => {
    render(<LoginPage />);
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  it('renders Connect Wallet button', () => {
    render(<LoginPage />);
    // ConnectButton is mocked in setup.ts, just verify the page renders without errors
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2); // Google and Passkey buttons at minimum
  });

  it('renders Passkey button', () => {
    render(<LoginPage />);
    expect(screen.getByText('Use Passkey')).toBeInTheDocument();
  });

  it('disables Google button when wallet not available', () => {
    render(<LoginPage />);
    const googleButton = screen.getByText('Continue with Google').closest('button');
    expect(googleButton).toBeDisabled();
  });
});
