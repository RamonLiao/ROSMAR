import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../messaging/email.service';
import { SendEmailAction } from './send-email.action';
import { AddToSegmentAction } from './add-to-segment.action';
import { UpdateTierAction } from './update-tier.action';
import { ConditionAction } from './condition.action';

// ─── Mocks ───────────────────────────────────────────────────────

const mockPrisma = {
  profile: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  segmentMembership: {
    upsert: jest.fn(),
  },
};

const mockEmailService = {
  sendMessage: jest.fn(),
};

// ─── SendEmailAction ─────────────────────────────────────────────

describe('SendEmailAction', () => {
  let action: SendEmailAction;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SendEmailAction,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();
    action = module.get(SendEmailAction);
  });

  it('should send email via EmailService', async () => {
    mockPrisma.profile.findUniqueOrThrow.mockResolvedValue({
      email: 'user@example.com',
      workspaceId: 'ws-1',
    });
    mockEmailService.sendMessage.mockResolvedValue({ messageId: 'msg-1' });

    await action.execute('profile-1', {
      subject: 'Hello',
      body: '<p>Welcome</p>',
      workspaceId: 'ws-1',
    });

    expect(mockEmailService.sendMessage).toHaveBeenCalledWith('ws-1', {
      profileId: 'profile-1',
      subject: 'Hello',
      body: '<p>Welcome</p>',
    });
  });

  it('should skip if profile has no email', async () => {
    mockPrisma.profile.findUniqueOrThrow.mockResolvedValue({
      email: null,
      workspaceId: 'ws-1',
    });

    await action.execute('profile-1', {
      subject: 'Hi',
      body: 'test',
      workspaceId: 'ws-1',
    });

    expect(mockEmailService.sendMessage).not.toHaveBeenCalled();
  });

  it('should fallback to profile workspaceId if not in config', async () => {
    mockPrisma.profile.findUniqueOrThrow.mockResolvedValue({
      email: 'a@b.com',
      workspaceId: 'ws-from-profile',
    });
    mockEmailService.sendMessage.mockResolvedValue({});

    await action.execute('profile-1', {
      subject: 'Hi',
      body: 'test',
      workspaceId: '',
    });

    expect(mockEmailService.sendMessage).toHaveBeenCalledWith(
      'ws-from-profile',
      expect.any(Object),
    );
  });
});

// ─── AddToSegmentAction ──────────────────────────────────────────

describe('AddToSegmentAction', () => {
  let action: AddToSegmentAction;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AddToSegmentAction,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    action = module.get(AddToSegmentAction);
  });

  it('should upsert segment membership', async () => {
    mockPrisma.segmentMembership.upsert.mockResolvedValue({});

    await action.execute('profile-1', { segmentId: 'seg-1' });

    expect(mockPrisma.segmentMembership.upsert).toHaveBeenCalledWith({
      where: {
        segmentId_profileId: { segmentId: 'seg-1', profileId: 'profile-1' },
      },
      create: { segmentId: 'seg-1', profileId: 'profile-1' },
      update: {},
    });
  });

  it('should throw if segmentId is missing', async () => {
    await expect(
      action.execute('profile-1', { segmentId: '' }),
    ).rejects.toThrow('segmentId is required');
  });
});

// ─── UpdateTierAction ────────────────────────────────────────────

describe('UpdateTierAction', () => {
  let action: UpdateTierAction;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        UpdateTierAction,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    action = module.get(UpdateTierAction);
  });

  it('should update profile tier', async () => {
    mockPrisma.profile.update.mockResolvedValue({});

    await action.execute('profile-1', { tier: 3 });

    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { tier: 3 },
    });
  });

  it('should clamp tier to 0-5 range', async () => {
    mockPrisma.profile.update.mockResolvedValue({});

    await action.execute('profile-1', { tier: 10 });
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { tier: 5 },
    });

    await action.execute('profile-1', { tier: -2 });
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { tier: 0 },
    });
  });

  it('should floor fractional tier values', async () => {
    mockPrisma.profile.update.mockResolvedValue({});

    await action.execute('profile-1', { tier: 2.7 });
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { tier: 2 },
    });
  });

  it('should throw if tier is missing', async () => {
    await expect(action.execute('profile-1', {} as any)).rejects.toThrow(
      'tier is required',
    );
  });
});

// ─── ConditionAction ─────────────────────────────────────────────

describe('ConditionAction', () => {
  let action: ConditionAction;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ConditionAction,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    action = module.get(ConditionAction);
  });

  it('should return yes when condition matches (eq)', async () => {
    mockPrisma.profile.findUniqueOrThrow.mockResolvedValue({
      tier: 3,
      engagementScore: 100,
      tags: ['vip'],
      primaryAddress: '0xABC',
      isArchived: false,
    });

    const result = await action.execute('profile-1', {
      field: 'tier',
      operator: 'eq',
      value: 3,
    });

    expect(result).toEqual({ branch: 'yes' });
  });

  it('should return no when condition does not match', async () => {
    mockPrisma.profile.findUniqueOrThrow.mockResolvedValue({
      tier: 1,
      engagementScore: 50,
      tags: [],
      primaryAddress: '0xABC',
      isArchived: false,
    });

    const result = await action.execute('profile-1', {
      field: 'tier',
      operator: 'gte',
      value: 3,
    });

    expect(result).toEqual({ branch: 'no' });
  });

  it('should support gt operator', async () => {
    mockPrisma.profile.findUniqueOrThrow.mockResolvedValue({
      tier: 4,
      engagementScore: 200,
      tags: [],
      primaryAddress: '0x1',
      isArchived: false,
    });

    const result = await action.execute('profile-1', {
      field: 'engagementScore',
      operator: 'gt',
      value: 100,
    });

    expect(result).toEqual({ branch: 'yes' });
  });

  it('should support contains on tags array', async () => {
    mockPrisma.profile.findUniqueOrThrow.mockResolvedValue({
      tier: 0,
      engagementScore: 0,
      tags: ['whale', 'early-adopter'],
      primaryAddress: '0x1',
      isArchived: false,
    });

    const result = await action.execute('profile-1', {
      field: 'tags',
      operator: 'contains',
      value: 'whale',
    });

    expect(result).toEqual({ branch: 'yes' });
  });

  it('should reject disallowed fields', async () => {
    await expect(
      action.execute('profile-1', {
        field: 'email' as any,
        operator: 'eq',
        value: 'x',
      }),
    ).rejects.toThrow('Field "email" not allowed');
  });

  it('should throw if field or operator is missing', async () => {
    await expect(
      action.execute('profile-1', {
        field: '',
        operator: 'eq',
        value: 1,
      } as any),
    ).rejects.toThrow('field and operator are required');
  });

  it('should support boolean isArchived check', async () => {
    mockPrisma.profile.findUniqueOrThrow.mockResolvedValue({
      tier: 0,
      engagementScore: 0,
      tags: [],
      primaryAddress: '0x1',
      isArchived: true,
    });

    const result = await action.execute('profile-1', {
      field: 'isArchived',
      operator: 'eq',
      value: true,
    });

    expect(result).toEqual({ branch: 'yes' });
  });
});
