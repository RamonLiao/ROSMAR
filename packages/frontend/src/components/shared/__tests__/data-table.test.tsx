import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DataTable } from '../data-table';

describe('DataTable', () => {
  const mockData = [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
  ];

  const mockColumns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
  ];

  it('renders table with data', () => {
    render(<DataTable data={mockData} columns={mockColumns} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<DataTable data={[]} columns={mockColumns} />);
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('renders search input when searchable is true', () => {
    render(<DataTable data={mockData} columns={mockColumns} searchable />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('calls onSearch when search input changes', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(
      <DataTable
        data={mockData}
        columns={mockColumns}
        searchable
        onSearch={onSearch}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'test');

    expect(onSearch).toHaveBeenCalled();
  });

  it('renders pagination controls when pagination prop provided', () => {
    const mockPagination = {
      page: 1,
      pageSize: 10,
      total: 20,
      onPageChange: vi.fn(),
    };

    render(
      <DataTable
        data={mockData}
        columns={mockColumns}
        pagination={mockPagination}
      />
    );

    expect(screen.getByText(/Showing 1 to/)).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('calls onPageChange when next button clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const mockPagination = {
      page: 1,
      pageSize: 10,
      total: 20,
      onPageChange,
    };

    render(
      <DataTable
        data={mockData}
        columns={mockColumns}
        pagination={mockPagination}
      />
    );

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
