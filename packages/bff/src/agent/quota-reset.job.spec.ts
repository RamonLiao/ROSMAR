import { Test } from '@nestjs/testing';
import { QuotaResetJob } from './quota-reset.job';
import { PrismaService } from '../prisma/prisma.service';

describe('QuotaResetJob', () => {
  let job: QuotaResetJob;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      workspaceAiConfig: {
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        QuotaResetJob,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    job = module.get(QuotaResetJob);
  });

  it('should reset usedQuotaUsd to 0 for configs past quotaResetAt', async () => {
    await job.handleQuotaReset();

    expect(prisma.workspaceAiConfig.updateMany).toHaveBeenCalledWith({
      where: { quotaResetAt: { lte: expect.any(Date) } },
      data: {
        usedQuotaUsd: 0,
        quotaResetAt: expect.any(Date),
      },
    });
  });

  it('should set quotaResetAt to first day of next month', async () => {
    await job.handleQuotaReset();

    const call = prisma.workspaceAiConfig.updateMany.mock.calls[0][0];
    const nextReset = call.data.quotaResetAt as Date;
    expect(nextReset.getDate()).toBe(1);
    expect(nextReset.getHours()).toBe(0);
  });
});
