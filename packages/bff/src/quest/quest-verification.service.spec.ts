import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { QuestVerificationService } from './quest-verification.service';
import { QuestService } from './quest.service';
import { PrismaService } from '../prisma/prisma.service';
import { IndexerVerifier } from './verifiers/indexer.verifier';
import { RpcVerifier } from './verifiers/rpc.verifier';
import { ManualVerifier } from './verifiers/manual.verifier';

describe('QuestVerificationService', () => {
  let service: QuestVerificationService;
  let prisma: any;
  let questService: any;
  let indexerVerifier: any;
  let rpcVerifier: any;
  let manualVerifier: any;

  const makeQuest = (verificationMethod = 'INDEXER') => ({
    id: 'q1',
    steps: [
      {
        id: 's1',
        questId: 'q1',
        orderIndex: 0,
        title: 'Swap',
        actionType: 'SWAP',
        actionConfig: {},
        verificationMethod,
        chain: 'SUI',
      },
      {
        id: 's2',
        questId: 'q1',
        orderIndex: 1,
        title: 'Stake',
        actionType: 'STAKE',
        actionConfig: {},
        verificationMethod,
        chain: 'SUI',
      },
    ],
  });

  beforeEach(async () => {
    prisma = {
      quest: { findUnique: jest.fn() },
      questStepCompletion: {
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
    };

    questService = {
      completeQuest: jest.fn(),
    };

    indexerVerifier = { verify: jest.fn() };
    rpcVerifier = { verify: jest.fn() };
    manualVerifier = { verify: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        QuestVerificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: QuestService, useValue: questService },
        { provide: IndexerVerifier, useValue: indexerVerifier },
        { provide: RpcVerifier, useValue: rpcVerifier },
        { provide: ManualVerifier, useValue: manualVerifier },
      ],
    }).compile();

    service = module.get(QuestVerificationService);
  });

  it('claimStep (INDEXER) — finds matching wallet_event, creates QuestStepCompletion', async () => {
    prisma.quest.findUnique.mockResolvedValue(makeQuest('INDEXER'));
    prisma.questStepCompletion.findUnique.mockResolvedValue(null);
    indexerVerifier.verify.mockResolvedValue({ verified: true, txDigest: '0xtx1' });
    prisma.questStepCompletion.create.mockResolvedValue({ id: 'sc1', stepId: 's1', profileId: 'p1' });
    prisma.questStepCompletion.count.mockResolvedValue(1); // 1 of 2 done

    const result = await service.claimStep('q1', 's1', 'p1', {});

    expect(result.status).toBe('step_completed');
    expect(indexerVerifier.verify).toHaveBeenCalledWith('p1', { actionType: 'SWAP', actionConfig: {} }, {});
    expect(prisma.questStepCompletion.create).toHaveBeenCalledWith({
      data: { stepId: 's1', profileId: 'p1', txDigest: '0xtx1', verifiedBy: 'INDEXER' },
    });
  });

  it('claimStep (RPC) — queries SUI RPC for TX, creates completion with txDigest', async () => {
    prisma.quest.findUnique.mockResolvedValue(makeQuest('RPC'));
    prisma.questStepCompletion.findUnique.mockResolvedValue(null);
    rpcVerifier.verify.mockResolvedValue({ verified: true, txDigest: '0xrpc_tx' });
    prisma.questStepCompletion.create.mockResolvedValue({ id: 'sc2', stepId: 's1', profileId: 'p1' });
    prisma.questStepCompletion.count.mockResolvedValue(1);

    const result = await service.claimStep('q1', 's1', 'p1', { txDigest: '0xrpc_tx' });

    expect(result.status).toBe('step_completed');
    expect(rpcVerifier.verify).toHaveBeenCalled();
    expect(prisma.questStepCompletion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ txDigest: '0xrpc_tx', verifiedBy: 'RPC' }),
    });
  });

  it('claimStep (MANUAL) — returns pending status (admin must approve)', async () => {
    prisma.quest.findUnique.mockResolvedValue(makeQuest('MANUAL'));
    prisma.questStepCompletion.findUnique.mockResolvedValue(null);
    manualVerifier.verify.mockResolvedValue({ verified: false });

    const result = await service.claimStep('q1', 's1', 'p1', {});

    expect(result.status).toBe('pending');
    expect(result.verified).toBe(false);
    expect(prisma.questStepCompletion.create).not.toHaveBeenCalled();
  });

  it('claimStep already completed — returns existing completion, no duplicate', async () => {
    const existing = { id: 'sc-existing', stepId: 's1', profileId: 'p1' };
    prisma.quest.findUnique.mockResolvedValue(makeQuest());
    prisma.questStepCompletion.findUnique.mockResolvedValue(existing);

    const result = await service.claimStep('q1', 's1', 'p1', {});

    expect(result.status).toBe('already_completed');
    expect(result.completion).toEqual(existing);
    expect(indexerVerifier.verify).not.toHaveBeenCalled();
    expect(prisma.questStepCompletion.create).not.toHaveBeenCalled();
  });

  it('claimStep all steps done — auto-triggers quest completion', async () => {
    prisma.quest.findUnique.mockResolvedValue(makeQuest('INDEXER'));
    prisma.questStepCompletion.findUnique.mockResolvedValue(null);
    indexerVerifier.verify.mockResolvedValue({ verified: true, txDigest: '0xlast' });
    prisma.questStepCompletion.create.mockResolvedValue({ id: 'sc3' });
    prisma.questStepCompletion.count.mockResolvedValue(2); // 2 of 2 done

    const result = await service.claimStep('q1', 's2', 'p1', {});

    expect(result.status).toBe('quest_completed');
    expect(questService.completeQuest).toHaveBeenCalledWith('q1', 'p1');
  });

  it('claimStep invalid quest — throws NotFoundException', async () => {
    prisma.quest.findUnique.mockResolvedValue(null);

    await expect(service.claimStep('bad-id', 's1', 'p1', {})).rejects.toThrow(NotFoundException);
  });
});
