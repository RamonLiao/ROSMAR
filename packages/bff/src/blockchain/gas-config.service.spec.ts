import { Test } from '@nestjs/testing';
import { GasConfigService } from './gas-config.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GasConfigService', () => {
  let service: GasConfigService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      workspaceGasConfig: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        GasConfigService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(GasConfigService);
  });

  describe('getConfig', () => {
    it('should return stored config when exists', async () => {
      const stored = {
        id: 'cfg-1',
        workspaceId: 'ws-1',
        enabled: true,
        thresholdMist: BigInt(200000000),
        dailyLimit: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.workspaceGasConfig.findUnique.mockResolvedValue(stored);

      const result = await service.getConfig('ws-1');

      expect(result).toEqual({
        enabled: true,
        thresholdMist: '200000000',
        dailyLimit: 10,
      });
    });

    it('should return defaults when no config exists', async () => {
      prisma.workspaceGasConfig.findUnique.mockResolvedValue(null);

      const result = await service.getConfig('ws-1');

      expect(result).toEqual({
        enabled: false,
        thresholdMist: '100000000',
        dailyLimit: 5,
      });
    });
  });

  describe('upsertConfig', () => {
    it('should upsert with provided values', async () => {
      prisma.workspaceGasConfig.upsert.mockResolvedValue({
        id: 'cfg-1',
        workspaceId: 'ws-1',
        enabled: true,
        thresholdMist: BigInt(500000000),
        dailyLimit: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.upsertConfig('ws-1', {
        enabled: true,
        thresholdMist: '500000000',
        dailyLimit: 20,
      });

      expect(prisma.workspaceGasConfig.upsert).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        create: {
          workspaceId: 'ws-1',
          enabled: true,
          thresholdMist: BigInt('500000000'),
          dailyLimit: 20,
        },
        update: {
          enabled: true,
          thresholdMist: BigInt('500000000'),
          dailyLimit: 20,
        },
      });
      expect(result.enabled).toBe(true);
    });

    it('should reject negative dailyLimit', async () => {
      await expect(
        service.upsertConfig('ws-1', { dailyLimit: -1 }),
      ).rejects.toThrow('dailyLimit must be non-negative');
    });

    it('should reject negative thresholdMist', async () => {
      await expect(
        service.upsertConfig('ws-1', { thresholdMist: '-100' }),
      ).rejects.toThrow('thresholdMist must be non-negative');
    });
  });

  describe('monkey tests', () => {
    it('should handle zero dailyLimit', async () => {
      prisma.workspaceGasConfig.upsert.mockResolvedValue({
        id: 'cfg-1', workspaceId: 'ws-1',
        enabled: true, thresholdMist: BigInt(100000000), dailyLimit: 0,
        createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.upsertConfig('ws-1', { dailyLimit: 0 });
      expect(result.dailyLimit).toBe(0);
    });

    it('should handle very large thresholdMist (100 SUI)', async () => {
      const largeMist = '100000000000';
      prisma.workspaceGasConfig.upsert.mockResolvedValue({
        id: 'cfg-1', workspaceId: 'ws-1',
        enabled: true, thresholdMist: BigInt(largeMist), dailyLimit: 5,
        createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.upsertConfig('ws-1', { thresholdMist: largeMist });
      expect(result.thresholdMist).toBe(largeMist);
    });

    it('should reject non-numeric thresholdMist string', async () => {
      await expect(
        service.upsertConfig('ws-1', { thresholdMist: 'not-a-number' }),
      ).rejects.toThrow();
    });

    it('should handle partial update (only enabled)', async () => {
      prisma.workspaceGasConfig.upsert.mockResolvedValue({
        id: 'cfg-1', workspaceId: 'ws-1',
        enabled: false, thresholdMist: BigInt(100000000), dailyLimit: 5,
        createdAt: new Date(), updatedAt: new Date(),
      });

      await service.upsertConfig('ws-1', { enabled: false });

      expect(prisma.workspaceGasConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { enabled: false },
        }),
      );
    });
  });
});
