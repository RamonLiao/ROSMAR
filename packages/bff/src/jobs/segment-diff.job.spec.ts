import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SegmentDiffJob } from './segment-diff.job';
import { PrismaService } from '../prisma/prisma.service';

describe('SegmentDiffJob', () => {
  let job: SegmentDiffJob;
  let prisma: any;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    prisma = {
      campaignTrigger: { findMany: jest.fn() },
      segmentMembership: { findMany: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        SegmentDiffJob,
        EventEmitter2,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    job = module.get(SegmentDiffJob);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should emit segment.entered for new members', async () => {
    // Triggers requiring segment_entered for seg-1
    prisma.campaignTrigger.findMany.mockResolvedValue([
      {
        id: 'trigger-1',
        triggerType: 'segment_entered',
        triggerConfig: { segmentId: 'seg-1' },
        isEnabled: true,
        campaign: { segmentId: 'seg-1' },
      },
    ]);

    const now = new Date();

    // First run: no previous snapshot, so new members = all current members
    prisma.segmentMembership.findMany.mockResolvedValue([
      { segmentId: 'seg-1', profileId: 'p1', joinedAt: now },
      { segmentId: 'seg-1', profileId: 'p2', joinedAt: now },
    ]);

    const emitSpy = jest.spyOn(eventEmitter, 'emit');

    await job.process({} as any);

    // First run establishes baseline, no events emitted
    expect(emitSpy).not.toHaveBeenCalledWith(
      'segment.entered',
      expect.anything(),
    );

    // Second run: add a new member
    prisma.segmentMembership.findMany.mockResolvedValue([
      { segmentId: 'seg-1', profileId: 'p1', joinedAt: now },
      { segmentId: 'seg-1', profileId: 'p2', joinedAt: now },
      { segmentId: 'seg-1', profileId: 'p3', joinedAt: new Date() },
    ]);

    await job.process({} as any);

    expect(emitSpy).toHaveBeenCalledWith('segment.entered', {
      event_type: 'segment_entered',
      segmentId: 'seg-1',
      profileId: 'p3',
    });
  });

  it('should emit segment.exited for removed members', async () => {
    prisma.campaignTrigger.findMany.mockResolvedValue([
      {
        id: 'trigger-2',
        triggerType: 'segment_exited',
        triggerConfig: { segmentId: 'seg-2' },
        isEnabled: true,
        campaign: { segmentId: 'seg-2' },
      },
    ]);

    const now = new Date();

    // First run: establish baseline
    prisma.segmentMembership.findMany.mockResolvedValue([
      { segmentId: 'seg-2', profileId: 'p1', joinedAt: now },
      { segmentId: 'seg-2', profileId: 'p2', joinedAt: now },
    ]);

    const emitSpy = jest.spyOn(eventEmitter, 'emit');

    await job.process({} as any);

    // Second run: p2 removed
    prisma.segmentMembership.findMany.mockResolvedValue([
      { segmentId: 'seg-2', profileId: 'p1', joinedAt: now },
    ]);

    await job.process({} as any);

    expect(emitSpy).toHaveBeenCalledWith('segment.exited', {
      event_type: 'segment_exited',
      segmentId: 'seg-2',
      profileId: 'p2',
    });
  });
});
