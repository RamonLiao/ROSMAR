import { Test } from '@nestjs/testing';
import { VaultExpiryJob } from './vault-expiry.job';
import { PrismaService } from '../prisma/prisma.service';

describe('VaultExpiryJob', () => {
  let job: VaultExpiryJob;
  let prisma: { vaultSecret: { deleteMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      vaultSecret: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };

    const module = await Test.createTestingModule({
      providers: [
        VaultExpiryJob,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    job = module.get(VaultExpiryJob);
  });

  it('should delete expired secrets', async () => {
    await job.archiveExpired();

    expect(prisma.vaultSecret.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { not: null, lte: expect.any(Date) },
      },
    });
  });

  it('should handle zero expired secrets gracefully', async () => {
    prisma.vaultSecret.deleteMany.mockResolvedValue({ count: 0 });

    await expect(job.archiveExpired()).resolves.not.toThrow();
  });
});
