/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { QuestBuilder } from '../quest-builder';
import { QuestList } from '../quest-list';
import { QuestProgressCard } from '../quest-progress-card';
import type { Quest } from '@/lib/hooks/use-quests';

// Mock Radix Select
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      data-testid="select"
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => <option value="">{placeholder}</option>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

describe('QuestList — T21', () => {
  const mockQuests: Quest[] = [
    {
      id: 'q1',
      workspaceId: 'ws1',
      name: 'DeFi Journey',
      isActive: true,
      rewardType: 'BADGE',
      rewardConfig: {},
      steps: [
        { id: 's1', questId: 'q1', orderIndex: 0, title: 'Swap', actionType: 'SWAP', actionConfig: {}, verificationMethod: 'INDEXER', chain: 'SUI' },
      ],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'q2',
      workspaceId: 'ws1',
      name: 'NFT Explorer',
      isActive: false,
      rewardType: 'TOKEN',
      rewardConfig: {},
      steps: [
        { id: 's2', questId: 'q2', orderIndex: 0, title: 'Mint', actionType: 'MINT_NFT', actionConfig: {}, verificationMethod: 'RPC', chain: 'EVM' },
        { id: 's3', questId: 'q2', orderIndex: 1, title: 'Hold', actionType: 'HOLD_TOKEN', actionConfig: {}, verificationMethod: 'INDEXER', chain: 'EVM' },
      ],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  it('renders quests with active/inactive badges', () => {
    render(<QuestList quests={mockQuests} />);
    expect(screen.getByText('DeFi Journey')).toBeInTheDocument();
    expect(screen.getByText('NFT Explorer')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });
});

describe('QuestBuilder — T21', () => {
  it('renders step editor for each step', () => {
    render(<QuestBuilder onSubmit={vi.fn()} />);
    // Default: 1 step
    expect(screen.getByTestId('step-editor-0')).toBeInTheDocument();
    expect(screen.getByText('Steps (1)')).toBeInTheDocument();
  });

  it('step editor allows setting actionType, verificationMethod, chain', () => {
    render(<QuestBuilder onSubmit={vi.fn()} />);
    // The step editor should have 3 select dropdowns
    const selects = screen.getAllByTestId('select');
    // 1 for reward type + 3 for step (action, verification, chain)
    expect(selects.length).toBeGreaterThanOrEqual(4);
  });

  it('adding step increases step count', async () => {
    render(<QuestBuilder onSubmit={vi.fn()} />);
    expect(screen.getByText('Steps (1)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add Step'));
    expect(screen.getByText('Steps (2)')).toBeInTheDocument();
    expect(screen.getByTestId('step-editor-1')).toBeInTheDocument();
  });

  it('removing step decreases step count', () => {
    render(<QuestBuilder onSubmit={vi.fn()} />);
    // Add a second step
    fireEvent.click(screen.getByText('Add Step'));
    expect(screen.getByText('Steps (2)')).toBeInTheDocument();

    // Remove the first step
    const removeButtons = screen.getAllByText('Remove');
    fireEvent.click(removeButtons[0]);
    expect(screen.getByText('Steps (1)')).toBeInTheDocument();
  });

  it('submit calls onSubmit with correct payload', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<QuestBuilder onSubmit={onSubmit} />);

    // Fill name
    await user.type(screen.getByPlaceholderText('Enter quest name'), 'Test Quest');

    // Fill step title
    await user.type(screen.getByPlaceholderText('Step title'), 'Step One');

    // Submit
    fireEvent.click(screen.getByText('Create Quest'));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Test Quest',
      description: undefined,
      rewardType: 'BADGE',
      steps: [
        {
          title: 'Step One',
          actionType: 'SWAP',
          verificationMethod: 'INDEXER',
          chain: 'SUI',
        },
      ],
    });
  });
});

describe('QuestProgressCard — T21', () => {
  it('shows step checklist with completion status', () => {
    const steps = [
      { id: 's1', questId: 'q1', orderIndex: 0, title: 'Swap on DEX', actionType: 'SWAP', actionConfig: {}, verificationMethod: 'INDEXER', chain: 'SUI' },
      { id: 's2', questId: 'q1', orderIndex: 1, title: 'Stake tokens', actionType: 'STAKE', actionConfig: {}, verificationMethod: 'RPC', chain: 'SUI' },
    ];
    const completedSteps = [{ stepId: 's1', completedAt: '2026-01-01' }];

    render(
      <QuestProgressCard
        questName="DeFi Journey"
        steps={steps}
        completedSteps={completedSteps}
        isCompleted={false}
      />,
    );

    expect(screen.getByText('DeFi Journey')).toBeInTheDocument();
    expect(screen.getByText('Swap on DEX')).toBeInTheDocument();
    expect(screen.getByText('Stake tokens')).toBeInTheDocument();

    // s1 completed, s2 pending
    const s1 = screen.getByTestId('step-s1');
    const s2 = screen.getByTestId('step-s2');
    expect(s1.querySelector('[aria-label="Completed"]')).toBeInTheDocument();
    expect(s2.querySelector('[aria-label="Pending"]')).toBeInTheDocument();
  });
});
