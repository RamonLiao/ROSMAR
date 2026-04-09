import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

// Mock SuiClientService to avoid ESM issues with @mysten/sui
jest.mock('../blockchain/sui.client', () => ({
  SuiClientService: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockReturnValue({
      getTransactionBlock: jest.fn(),
      getOwnedObjects: jest.fn(),
    }),
  })),
}));

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
    indexerVerifier.verify.mockResolvedValue({
      verified: true,
      txDigest: '0xtx1',
    });
    prisma.questStepCompletion.create.mockResolvedValue({
      id: 'sc1',
      stepId: 's1',
      profileId: 'p1',
    });
    prisma.questStepCompletion.count.mockResolvedValue(1); // 1 of 2 done

    const result = await service.claimStep('q1', 's1', 'p1', {});

    expect(result.status).toBe('step_completed');
    expect(indexerVerifier.verify).toHaveBeenCalledWith(
      'p1',
      { actionType: 'SWAP', actionConfig: {} },
      {},
    );
    expect(prisma.questStepCompletion.create).toHaveBeenCalledWith({
      data: {
        stepId: 's1',
        profileId: 'p1',
        txDigest: '0xtx1',
        verifiedBy: 'INDEXER',
      },
    });
  });

  it('claimStep (RPC) — queries SUI RPC for TX, creates completion with txDigest', async () => {
    prisma.quest.findUnique.mockResolvedValue(makeQuest('RPC'));
    prisma.questStepCompletion.findUnique.mockResolvedValue(null);
    rpcVerifier.verify.mockResolvedValue({
      verified: true,
      txDigest: '0xrpc_tx',
    });
    prisma.questStepCompletion.create.mockResolvedValue({
      id: 'sc2',
      stepId: 's1',
      profileId: 'p1',
    });
    prisma.questStepCompletion.count.mockResolvedValue(1);

    const result = await service.claimStep('q1', 's1', 'p1', {
      txDigest: '0xrpc_tx',
    });

    expect(result.status).toBe('step_completed');
    expect(rpcVerifier.verify).toHaveBeenCalled();
    expect(prisma.questStepCompletion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        txDigest: '0xrpc_tx',
        verifiedBy: 'RPC',
      }),
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
    indexerVerifier.verify.mockResolvedValue({
      verified: true,
      txDigest: '0xlast',
    });
    prisma.questStepCompletion.create.mockResolvedValue({ id: 'sc3' });
    prisma.questStepCompletion.count.mockResolvedValue(2); // 2 of 2 done

    const result = await service.claimStep('q1', 's2', 'p1', {});

    expect(result.status).toBe('quest_completed');
    expect(questService.completeQuest).toHaveBeenCalledWith('q1', 'p1');
  });

  it('claimStep invalid quest — throws NotFoundException', async () => {
    prisma.quest.findUnique.mockResolvedValue(null);

    await expect(service.claimStep('bad-id', 's1', 'p1', {})).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('RpcVerifier (unit)', () => {
  let verifier: RpcVerifier;
  let mockSuiClient: any;

  const mockTx = {
    effects: { status: { status: 'success' } },
    balanceChanges: [
      {
        owner: { AddressOwner: '0xrecipient' },
        coinType: '0x2::sui::SUI',
        amount: '2000000000',
      },
    ],
    events: [],
  };

  beforeEach(() => {
    mockSuiClient = {
      getClient: jest.fn().mockReturnValue({
        getTransactionBlock: jest.fn().mockResolvedValue(mockTx),
        getOwnedObjects: jest.fn().mockResolvedValue({ data: [] }),
      }),
    };
    verifier = new RpcVerifier(mockSuiClient);
  });

  it('token_transfer — verified when recipient/coinType/amount match', async () => {
    const result = await verifier.verify(
      'p1',
      {
        actionType: 'TRANSFER',
        actionConfig: {
          verificationType: 'token_transfer',
          verificationConfig: {
            recipient: '0xrecipient',
            coinType: '0x2::sui::SUI',
            minAmount: '1000000000',
          },
        },
      },
      { txDigest: '0xtx1' },
    );

    expect(result).toEqual({ verified: true, txDigest: '0xtx1' });
  });

  it('token_transfer — fails when amount insufficient', async () => {
    const result = await verifier.verify(
      'p1',
      {
        actionType: 'TRANSFER',
        actionConfig: {
          verificationType: 'token_transfer',
          verificationConfig: {
            recipient: '0xrecipient',
            coinType: '0x2::sui::SUI',
            minAmount: '5000000000',
          },
        },
      },
      { txDigest: '0xtx1' },
    );

    expect(result).toEqual({ verified: false, txDigest: '0xtx1' });
  });

  it('any_tx — verified for any successful transaction', async () => {
    const result = await verifier.verify(
      'p1',
      { actionType: 'ANY', actionConfig: {} },
      { txDigest: '0xtx1' },
    );

    expect(result).toEqual({ verified: true, txDigest: '0xtx1' });
  });

  it('returns verified:false when txDigest is missing', async () => {
    const result = await verifier.verify(
      'p1',
      { actionType: 'ANY', actionConfig: {} },
      {},
    );

    expect(result).toEqual({ verified: false });
  });

  it('returns verified:false when tx status is not success', async () => {
    mockSuiClient.getClient().getTransactionBlock.mockResolvedValue({
      effects: { status: { status: 'failure' } },
      balanceChanges: [],
      events: [],
    });

    const result = await verifier.verify(
      'p1',
      { actionType: 'ANY', actionConfig: { verificationType: 'token_transfer', verificationConfig: { recipient: '0x1' } } },
      { txDigest: '0xfail' },
    );

    expect(result).toEqual({ verified: false, txDigest: '0xfail' });
  });

  it('object_ownership — verified when objects found', async () => {
    mockSuiClient.getClient().getOwnedObjects.mockResolvedValue({
      data: [{ objectId: '0xobj1' }],
    });

    const result = await verifier.verify(
      '0xowner',
      {
        actionType: 'OWN',
        actionConfig: {
          verificationType: 'object_ownership',
          verificationConfig: { structType: '0xpkg::mod::NFT' },
        },
      },
      {},
    );

    expect(result).toEqual({ verified: true });
  });

  it('nft_mint — verified when event matches package', async () => {
    mockSuiClient.getClient().getTransactionBlock.mockResolvedValue({
      effects: { status: { status: 'success' } },
      balanceChanges: [],
      events: [{ type: '0xpkg::nft::MintEvent', parsedJson: {} }],
    });

    const result = await verifier.verify(
      'p1',
      {
        actionType: 'MINT',
        actionConfig: {
          verificationType: 'nft_mint',
          verificationConfig: {
            originalPackageId: '0xpkg',
            eventName: 'MintEvent',
          },
        },
      },
      { txDigest: '0xtx_mint' },
    );

    expect(result).toEqual({ verified: true, txDigest: '0xtx_mint' });
  });

  it('contract_call — verified when MoveCall target matches', async () => {
    mockSuiClient.getClient().getTransactionBlock.mockResolvedValue({
      effects: { status: { status: 'success' } },
      balanceChanges: [],
      events: [],
      transaction: {
        data: {
          transaction: {
            commands: [
              { MoveCall: { package: '0xpkg', module: 'swap', function: 'execute' } },
            ],
          },
        },
      },
    });

    const result = await verifier.verify(
      'p1',
      {
        actionType: 'CALL',
        actionConfig: {
          verificationType: 'contract_call',
          verificationConfig: { target: '0xpkg::swap::execute' },
        },
      },
      { txDigest: '0xtx_call' },
    );

    expect(result).toEqual({ verified: true, txDigest: '0xtx_call' });
  });
});
