import { render, screen } from '@/test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import { KanbanBoard } from '../kanban-board';

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

describe('KanbanBoard', () => {
  const mockDeals = [
    {
      id: '1',
      title: 'Deal 1',
      value: 10000,
      stage: 'prospecting',
      profileName: 'Alice',
      probability: 50,
    },
    {
      id: '2',
      title: 'Deal 2',
      value: 20000,
      stage: 'qualification',
      profileName: 'Bob',
      probability: 70,
    },
  ];

  const mockOnStageChange = vi.fn();

  it('renders all kanban stages', () => {
    render(<KanbanBoard deals={mockDeals} onStageChange={mockOnStageChange} />);
    expect(screen.getByText('Prospecting')).toBeInTheDocument();
    expect(screen.getByText('Qualification')).toBeInTheDocument();
    expect(screen.getByText('Proposal')).toBeInTheDocument();
    expect(screen.getByText('Negotiation')).toBeInTheDocument();
    expect(screen.getByText('Closed Won')).toBeInTheDocument();
    expect(screen.getByText('Closed Lost')).toBeInTheDocument();
  });

  it('renders deals in correct stages', () => {
    render(<KanbanBoard deals={mockDeals} onStageChange={mockOnStageChange} />);
    expect(screen.getByText('Deal 1')).toBeInTheDocument();
    expect(screen.getByText('Deal 2')).toBeInTheDocument();
  });

  it('renders empty board when no deals', () => {
    render(<KanbanBoard deals={[]} onStageChange={mockOnStageChange} />);
    const zeroCounts = screen.getAllByText('0');
    expect(zeroCounts).toHaveLength(6);
  });
});
