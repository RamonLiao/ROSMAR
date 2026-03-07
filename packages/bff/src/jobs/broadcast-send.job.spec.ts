import { Test } from '@nestjs/testing';
import { BroadcastSendJob } from './broadcast-send.job';
import { PrismaService } from '../prisma/prisma.service';
import { BroadcastService } from '../broadcast/broadcast.service';

describe('BroadcastSendJob', () => {
  let job: BroadcastSendJob;
  let prisma: any;
  let broadcastService: any;

  beforeEach(async () => {
    prisma = {
      broadcast: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    broadcastService = {
      send: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        BroadcastSendJob,
        { provide: PrismaService, useValue: prisma },
        { provide: BroadcastService, useValue: broadcastService },
      ],
    }).compile();

    job = module.get(BroadcastSendJob);
  });

  it('should send scheduled broadcasts whose time has passed', async () => {
    const pastDate = new Date('2020-01-01');
    prisma.broadcast.findMany.mockResolvedValue([
      { id: 'b-1', scheduledAt: pastDate },
      { id: 'b-2', scheduledAt: pastDate },
    ]);
    broadcastService.send.mockResolvedValue(undefined);

    await job.handleScheduledBroadcasts();

    expect(prisma.broadcast.findMany).toHaveBeenCalledWith({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: expect.any(Date) },
      },
    });
    expect(broadcastService.send).toHaveBeenCalledTimes(2);
    expect(broadcastService.send).toHaveBeenCalledWith('b-1');
    expect(broadcastService.send).toHaveBeenCalledWith('b-2');
  });

  it('should handle send errors and update status to failed', async () => {
    prisma.broadcast.findMany.mockResolvedValue([{ id: 'b-1' }]);
    broadcastService.send.mockRejectedValue(new Error('send failed'));
    prisma.broadcast.update.mockResolvedValue({});

    await job.handleScheduledBroadcasts();

    expect(prisma.broadcast.update).toHaveBeenCalledWith({
      where: { id: 'b-1' },
      data: { status: 'failed' },
    });
  });

  it('should do nothing when no scheduled broadcasts exist', async () => {
    prisma.broadcast.findMany.mockResolvedValue([]);

    await job.handleScheduledBroadcasts();

    expect(broadcastService.send).not.toHaveBeenCalled();
  });
});
