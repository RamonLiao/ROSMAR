import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TriggerMatcherService } from './trigger-matcher.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock WorkflowEngine to avoid transitive @mysten/sui imports
jest.mock('../workflow/workflow.engine', () => ({
  WorkflowEngine: jest.fn().mockImplementation(() => ({
    startWorkflow: jest.fn(),
  })),
}));

import { WorkflowEngine } from '../workflow/workflow.engine';

describe('TriggerMatcherService', () => {
  let service: TriggerMatcherService;
  let prisma: any;
  let workflowEngine: any;

  beforeEach(async () => {
    prisma = {
      campaignTrigger: { findMany: jest.fn() },
    };
    workflowEngine = { startWorkflow: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TriggerMatcherService,
        EventEmitter2,
        { provide: PrismaService, useValue: prisma },
        { provide: WorkflowEngine, useValue: workflowEngine },
      ],
    }).compile();

    service = module.get(TriggerMatcherService);
  });

  it('should match nft_minted trigger and start workflow', async () => {
    prisma.campaignTrigger.findMany.mockResolvedValue([
      {
        id: 'trigger-1',
        campaignId: 'campaign-1',
        triggerType: 'nft_minted',
        triggerConfig: { collection: 'test-collection' },
        isEnabled: true,
        campaign: {
          id: 'campaign-1',
          status: 'active',
          workflowSteps: [{ type: 'send_telegram', config: {} }],
        },
      },
    ]);

    await service.handleIndexerEvent({
      event_id: 'evt-1',
      event_type: 'nft_minted',
      address: '0xabc',
      profile_id: 'profile-1',
      data: { collection: 'test-collection' },
      tx_digest: '0xtx1',
      timestamp: Date.now(),
    });

    expect(workflowEngine.startWorkflow).toHaveBeenCalledWith(
      'campaign-1',
      [{ type: 'send_telegram', config: {} }],
      ['profile-1'],
    );
  });

  it('should NOT trigger when collection does not match', async () => {
    prisma.campaignTrigger.findMany.mockResolvedValue([
      {
        id: 'trigger-1',
        campaignId: 'campaign-1',
        triggerType: 'nft_minted',
        triggerConfig: { collection: 'other-collection' },
        isEnabled: true,
        campaign: { id: 'campaign-1', status: 'active', workflowSteps: [] },
      },
    ]);

    await service.handleIndexerEvent({
      event_id: 'evt-1',
      event_type: 'nft_minted',
      address: '0xabc',
      profile_id: 'profile-1',
      data: { collection: 'test-collection' },
      tx_digest: '0xtx1',
      timestamp: Date.now(),
    });

    expect(workflowEngine.startWorkflow).not.toHaveBeenCalled();
  });

  it('should NOT trigger when campaign status is not active', async () => {
    prisma.campaignTrigger.findMany.mockResolvedValue([
      {
        id: 'trigger-1',
        campaignId: 'campaign-1',
        triggerType: 'nft_minted',
        triggerConfig: { collection: 'test-collection' },
        isEnabled: true,
        campaign: { id: 'campaign-1', status: 'draft', workflowSteps: [] },
      },
    ]);

    await service.handleIndexerEvent({
      event_id: 'evt-1',
      event_type: 'nft_minted',
      address: '0xabc',
      profile_id: 'profile-1',
      data: { collection: 'test-collection' },
      tx_digest: '0xtx1',
      timestamp: Date.now(),
    });

    expect(workflowEngine.startWorkflow).not.toHaveBeenCalled();
  });

  it('should NOT trigger when profile_id is missing', async () => {
    prisma.campaignTrigger.findMany.mockResolvedValue([
      {
        id: 'trigger-1',
        campaignId: 'campaign-1',
        triggerType: 'nft_minted',
        triggerConfig: { collection: 'test-collection' },
        isEnabled: true,
        campaign: {
          id: 'campaign-1',
          status: 'active',
          workflowSteps: [{ type: 'send_telegram', config: {} }],
        },
      },
    ]);

    await service.handleIndexerEvent({
      event_id: 'evt-1',
      event_type: 'nft_minted',
      address: '0xabc',
      data: { collection: 'test-collection' },
      tx_digest: '0xtx1',
      timestamp: Date.now(),
    });

    expect(workflowEngine.startWorkflow).not.toHaveBeenCalled();
  });

  it('should handle segment.entered events', async () => {
    prisma.campaignTrigger.findMany.mockResolvedValue([
      {
        id: 'trigger-2',
        campaignId: 'campaign-2',
        triggerType: 'segment_entered',
        triggerConfig: { segmentId: 'seg-1' },
        isEnabled: true,
        campaign: {
          id: 'campaign-2',
          status: 'active',
          workflowSteps: [{ type: 'send_discord', config: {} }],
        },
      },
    ]);

    await service.handleSegmentEntered({
      event_type: 'segment_entered',
      segmentId: 'seg-1',
      profileId: 'profile-2',
    });

    expect(workflowEngine.startWorkflow).toHaveBeenCalledWith(
      'campaign-2',
      [{ type: 'send_discord', config: {} }],
      ['profile-2'],
    );
  });
});
