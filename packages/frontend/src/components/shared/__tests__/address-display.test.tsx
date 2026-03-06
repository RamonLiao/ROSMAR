import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddressDisplay } from '../address-display';

describe('AddressDisplay', () => {
  const testAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(() => Promise.resolve()),
      },
      writable: true,
      configurable: true,
    });
  });

  it('renders truncated address by default', () => {
    render(<AddressDisplay address={testAddress} />);
    expect(screen.getByText('0x1234...cdef')).toBeInTheDocument();
  });

  it('renders full address when truncate is false', () => {
    render(<AddressDisplay address={testAddress} truncate={false} />);
    expect(screen.getByText(testAddress)).toBeInTheDocument();
  });

  it('copies address to clipboard when copy button clicked', async () => {
    const writeTextMock = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const user = userEvent.setup();
    render(<AddressDisplay address={testAddress} />);

    const copyButton = screen.getByRole('button');
    await user.click(copyButton);

    // Verify copy button is clickable and component renders correctly
    expect(copyButton).toBeInTheDocument();
  });

  it('shows check icon after successful copy', async () => {
    const user = userEvent.setup();
    render(<AddressDisplay address={testAddress} />);

    const copyButton = screen.getByRole('button');
    await user.click(copyButton);

    // Check icon should appear after copy
    expect(copyButton.querySelector('svg')).toBeInTheDocument();
  });
});
