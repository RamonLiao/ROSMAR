import { Test } from '@nestjs/testing';
import { ContentService } from './content.service';
import { LlmClientService } from '../llm-client.service';
import { UsageTrackingService } from '../usage-tracking.service';

describe('ContentService', () => {
  let service: ContentService;
  let llmClient: { generate: jest.Mock; resolveConfig: jest.Mock };
  let usageTracking: { trackUsage: jest.Mock };

  beforeEach(async () => {
    llmClient = {
      generate: jest.fn(),
      resolveConfig: jest.fn().mockResolvedValue({ model: 'gpt-4o-mini' }),
    };
    usageTracking = { trackUsage: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        ContentService,
        { provide: LlmClientService, useValue: llmClient },
        { provide: UsageTrackingService, useValue: usageTracking },
      ],
    }).compile();

    service = module.get(ContentService);
  });

  it('should call LLM with segment + channel + tone and return formatted content', async () => {
    llmClient.generate.mockResolvedValue({
      text: 'Hey NFT holders! Check out our new drop.',
      usage: { promptTokens: 120, completionTokens: 40 },
    });

    const result = await service.generateContent({
      workspaceId: 'ws-1',
      userId: 'user-1',
      segmentDescription: 'Active NFT collectors with 10+ mints',
      channel: 'telegram',
      tone: 'casual',
    });

    expect(result.content).toBe('Hey NFT holders! Check out our new drop.');
    expect(llmClient.generate).toHaveBeenCalledTimes(1);

    // Verify system prompt includes channel-specific rules
    const callArgs = llmClient.generate.mock.calls[0];
    expect(callArgs[1].system.toLowerCase()).toContain('telegram');
    expect(callArgs[1].system).toContain('4096');
  });

  it('should return subject for email channel', async () => {
    llmClient.generate.mockResolvedValue({
      text: 'SUBJECT: Your Weekly Recap\n---\n<p>Hello valued member...</p>',
      usage: { promptTokens: 150, completionTokens: 80 },
    });

    const result = await service.generateContent({
      workspaceId: 'ws-1',
      userId: 'user-1',
      segmentDescription: 'Premium members',
      channel: 'email',
      tone: 'professional',
    });

    expect(result.subject).toBe('Your Weekly Recap');
    expect(result.content).toContain('<p>Hello valued member...</p>');
  });

  it('should track usage after generation', async () => {
    llmClient.generate.mockResolvedValue({
      text: 'Content here',
      usage: { promptTokens: 100, completionTokens: 50 },
    });

    await service.generateContent({
      workspaceId: 'ws-1',
      userId: 'user-1',
      segmentDescription: 'All users',
      channel: 'discord',
      tone: 'friendly',
    });

    expect(usageTracking.trackUsage).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'user-1',
      agentType: 'content',
      model: 'gpt-4o-mini',
      promptTokens: 100,
      completionTokens: 50,
    });
  });

  it('should include X/Twitter char limit in system prompt for x channel', async () => {
    llmClient.generate.mockResolvedValue({
      text: 'Short tweet #web3',
      usage: { promptTokens: 80, completionTokens: 20 },
    });

    await service.generateContent({
      workspaceId: 'ws-1',
      userId: 'user-1',
      segmentDescription: 'Twitter followers',
      channel: 'x',
      tone: 'witty',
    });

    const callArgs = llmClient.generate.mock.calls[0];
    expect(callArgs[1].system).toContain('280');
  });
});
