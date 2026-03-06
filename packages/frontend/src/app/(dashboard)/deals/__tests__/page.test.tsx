import { render, screen } from '@/test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import DealsPage from '../page';

vi.mock('@/lib/hooks/use-profiles', () => ({
  useProfiles: () => ({ data: [], isLoading: false }),
  useCreateProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/hooks/use-deals', () => ({
  useCreateDeal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeals: () => ({
    data: {
      deals: [
        {
          id: '1',
          title: 'Enterprise Deal',
          stage: 'qualification',
          amountUsd: '50000',
          profileId: 'profile-1',
          version: 1,
        },
        {
          id: '2',
          title: 'Startup Deal',
          stage: 'proposal',
          amountUsd: '15000',
          profileId: 'profile-2',
          version: 1,
        },
      ],
    },
    isLoading: false,
    error: null,
  }),
  useUpdateDealStage: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  PointerSensor: vi.fn(),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
  rectSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

describe('DealsPage', () => {
  it('renders deals page title', () => {
    render(<DealsPage />);
    expect(screen.getByText('Deals Pipeline')).toBeInTheDocument();
  });

  it('renders page description', () => {
    render(<DealsPage />);
    expect(
      screen.getByText('Drag and drop deals to update stages')
    ).toBeInTheDocument();
  });

  it('renders New Deal button', () => {
    render(<DealsPage />);
    expect(screen.getByText('New Deal')).toBeInTheDocument();
  });

  it('renders kanban board stages', () => {
    render(<DealsPage />);
    expect(screen.getByText('Prospecting')).toBeInTheDocument();
    expect(screen.getByText('Qualification')).toBeInTheDocument();
    expect(screen.getByText('Proposal')).toBeInTheDocument();
    expect(screen.getByText('Negotiation')).toBeInTheDocument();
    expect(screen.getByText('Closed Won')).toBeInTheDocument();
    expect(screen.getByText('Closed Lost')).toBeInTheDocument();
  });
});
