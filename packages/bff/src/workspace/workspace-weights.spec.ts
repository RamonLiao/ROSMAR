import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { PrismaService } from '../prisma/prisma.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_WEIGHTS } from '../engagement/engagement.constants';

// Mock the @mysten/sui ESM imports to avoid transform issues
jest.mock('../blockchain/sui.client', () => ({
  SuiClientService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../blockchain/tx-builder.service', () => ({
  TxBuilderService: jest.fn().mockImplementation(() => ({})),
}));

describe('WorkspaceService — engagement weights', () => {
  let service: WorkspaceService;
  let prisma: {
    workspace: {
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      workspace: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: PrismaService, useValue: prisma },
        { provide: SuiClientService, useValue: {} },
        { provide: TxBuilderService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('false') },
        },
      ],
    }).compile();

    service = module.get(WorkspaceService);
  });

  it('should return default weights when none configured', async () => {
    prisma.workspace.findUniqueOrThrow.mockResolvedValue({
      engagementWeights: null,
    });

    const result = await service.getEngagementWeights('ws-1');
    expect(result).toEqual(DEFAULT_WEIGHTS);
  });

  it('should save and return custom weights', async () => {
    const custom = {
      holdTime: 0.4,
      txCount: 0.15,
      txValue: 0.15,
      voteCount: 0.15,
      nftCount: 0.15,
    };

    prisma.workspace.update.mockResolvedValue({});

    const result = await service.setEngagementWeights('ws-1', custom);
    expect(result).toEqual(custom);
    expect(prisma.workspace.update).toHaveBeenCalledWith({
      where: { id: 'ws-1' },
      data: { engagementWeights: custom },
    });
  });

  it('should reject weights that do not sum to ~1.0', async () => {
    const bad = {
      holdTime: 0.5,
      txCount: 0.5,
      txValue: 0.5,
      voteCount: 0.5,
      nftCount: 0.5,
    };

    await expect(
      service.setEngagementWeights('ws-1', bad),
    ).rejects.toThrow(BadRequestException);
  });
});
