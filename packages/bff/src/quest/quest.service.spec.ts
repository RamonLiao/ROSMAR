import { Test } from '@nestjs/testing';
import { QuestService } from './quest.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('QuestService', () => {
  let service: QuestService;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prisma = {
      quest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      questStep: {
        create: jest.fn(),
      },
      questCompletion: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      questStepCompletion: {
        count: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        QuestService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(QuestService);
  });

  it('createQuest — creates quest + steps in $transaction', async () => {
    const quest = { id: 'q1', name: 'Onboarding Quest', workspaceId: 'ws1' };
    prisma.quest.create.mockResolvedValue(quest);
    prisma.questStep.create.mockResolvedValue({});

    const result = await service.createQuest({
      workspaceId: 'ws1',
      name: 'Onboarding Quest',
      description: 'Complete these steps',
      steps: [
        { title: 'Swap tokens', actionType: 'SWAP' },
        { title: 'Stake SUI', actionType: 'STAKE', verificationMethod: 'RPC' },
      ],
    });

    expect(result).toEqual(quest);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.quest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'ws1',
        name: 'Onboarding Quest',
        rewardType: 'BADGE',
      }),
    });
    expect(prisma.questStep.create).toHaveBeenCalledTimes(2);
    expect(prisma.questStep.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        questId: 'q1',
        orderIndex: 0,
        title: 'Swap tokens',
        actionType: 'SWAP',
        verificationMethod: 'INDEXER',
      }),
    });
    expect(prisma.questStep.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        questId: 'q1',
        orderIndex: 1,
        title: 'Stake SUI',
        actionType: 'STAKE',
        verificationMethod: 'RPC',
      }),
    });
  });

  it('listQuests — returns active quests for workspace', async () => {
    const quests = [
      {
        id: 'q1',
        name: 'Quest 1',
        isActive: true,
        steps: [],
        _count: { completions: 3 },
      },
      {
        id: 'q2',
        name: 'Quest 2',
        isActive: true,
        steps: [],
        _count: { completions: 0 },
      },
    ];
    prisma.quest.findMany.mockResolvedValue(quests);

    const result = await service.listQuests('ws1');

    expect(result).toEqual(quests);
    expect(prisma.quest.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws1', isActive: true },
      include: {
        steps: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { completions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('getQuest — returns quest with steps and completion counts', async () => {
    const quest = {
      id: 'q1',
      name: 'Quest',
      steps: [{ id: 's1', title: 'Step 1', orderIndex: 0 }],
      _count: { completions: 5 },
    };
    prisma.quest.findUnique.mockResolvedValue(quest);

    const result = await service.getQuest('q1');

    expect(result).toEqual(quest);
    expect(prisma.quest.findUnique).toHaveBeenCalledWith({
      where: { id: 'q1' },
      include: {
        steps: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { completions: true } },
      },
    });
  });

  it('updateQuest — updates name, description, isActive', async () => {
    const updated = { id: 'q1', name: 'Updated', isActive: false };
    prisma.quest.update.mockResolvedValue(updated);

    const result = await service.updateQuest('q1', {
      name: 'Updated',
      isActive: false,
    });

    expect(result).toEqual(updated);
    expect(prisma.quest.update).toHaveBeenCalledWith({
      where: { id: 'q1' },
      data: { name: 'Updated', isActive: false },
    });
  });

  it('getProgress — returns step completion status for a profile', async () => {
    const now = new Date();
    prisma.quest.findUnique.mockResolvedValue({
      id: 'q1',
      steps: [
        {
          id: 's1',
          title: 'Step 1',
          orderIndex: 0,
          stepCompletions: [{ completedAt: now }],
        },
        { id: 's2', title: 'Step 2', orderIndex: 1, stepCompletions: [] },
      ],
    });
    prisma.questCompletion.findUnique.mockResolvedValue(null);

    const result = await service.getProgress('q1', 'p1');

    expect(result).toEqual({
      questId: 'q1',
      profileId: 'p1',
      completed: false,
      completedAt: null,
      steps: [
        {
          id: 's1',
          title: 'Step 1',
          orderIndex: 0,
          completed: true,
          completedAt: now,
        },
        {
          id: 's2',
          title: 'Step 2',
          orderIndex: 1,
          completed: false,
          completedAt: null,
        },
      ],
    });
  });

  it('completeQuest — marks quest done, creates QuestCompletion record', async () => {
    const completion = {
      id: 'c1',
      questId: 'q1',
      profileId: 'p1',
      badgeSuiId: '0xbadge',
    };
    prisma.questCompletion.upsert.mockResolvedValue(completion);

    const result = await service.completeQuest('q1', 'p1', '0xbadge');

    expect(result).toEqual(completion);
    expect(prisma.questCompletion.upsert).toHaveBeenCalledWith({
      where: { questId_profileId: { questId: 'q1', profileId: 'p1' } },
      create: { questId: 'q1', profileId: 'p1', badgeSuiId: '0xbadge' },
      update: {},
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith('quest.completed', {
      questId: 'q1',
      profileId: 'p1',
    });
  });
});
