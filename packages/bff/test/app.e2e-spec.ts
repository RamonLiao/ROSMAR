import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SessionGuard } from '../src/auth/guards/session.guard';
import { RbacGuard } from '../src/auth/guards/rbac.guard';
import { SuiClientService } from '../src/blockchain/sui.client';
import { TxBuilderService } from '../src/blockchain/tx-builder.service';

// ---------- Mocks ----------

const mockUser = {
  address: '0xabc123',
  workspaceId: 'ws-001',
  role: 3,
  permissions: 31,
};

/** SessionGuard that always sets req.user */
const mockSessionGuard = {
  canActivate: (ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    req.user = { ...mockUser };
    return true;
  },
};

/** RbacGuard that always allows */
const mockRbacGuard = { canActivate: () => true };

/** Minimal PrismaService mock — each test suite fills in the methods it needs */
function buildPrismaMock() {
  return {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),

    // Deal
    deal: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    // Profile
    profile: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    // Organization
    organization: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    // ProfileOrganization
    profileOrganization: {
      create: jest.fn(),
    },
    // Segment
    segment: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    // SegmentMembership
    segmentMembership: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    // Campaign
    campaign: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    // Workspace
    workspace: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

const mockSuiClient = {
  executeTransaction: jest.fn().mockResolvedValue({
    digest: 'dry-run',
    events: [],
    effects: { status: { status: 'success' } },
    objectChanges: [],
  }),
  getClient: jest.fn(),
  getAddress: jest.fn().mockReturnValue('0xdeployer'),
  getObject: jest.fn(),
  multiGetObjects: jest.fn(),
  queryEvents: jest.fn(),
};

const mockTxBuilder = {
  buildCreateDealTx: jest.fn().mockReturnValue({}),
  buildUpdateDealTx: jest.fn().mockReturnValue({}),
  buildUpdateDealStageTx: jest.fn().mockReturnValue({}),
  buildCreateProfileTx: jest.fn().mockReturnValue({}),
  buildArchiveProfileTx: jest.fn().mockReturnValue({}),
  buildUpdateProfileTagsTx: jest.fn().mockReturnValue({}),
  buildCreateOrganizationTx: jest.fn().mockReturnValue({}),
  buildUpdateOrganizationTx: jest.fn().mockReturnValue({}),
  buildLinkProfileToOrgTx: jest.fn().mockReturnValue({}),
  buildCreateSegmentTx: jest.fn().mockReturnValue({}),
  buildUpdateSegmentTx: jest.fn().mockReturnValue({}),
  buildCreateWorkspaceTx: jest.fn().mockReturnValue({}),
  buildAddMemberTx: jest.fn().mockReturnValue({}),
  buildRemoveMemberTx: jest.fn().mockReturnValue({}),
  buildCreateCampaignTx: jest.fn().mockReturnValue({}),
  buildUpdateCampaignTx: jest.fn().mockReturnValue({}),
};

// ---------- Bootstrap ----------

let app: INestApplication<App>;
let prisma: ReturnType<typeof buildPrismaMock>;

beforeAll(async () => {
  prisma = buildPrismaMock();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(SuiClientService)
    .useValue(mockSuiClient)
    .overrideProvider(TxBuilderService)
    .useValue(mockTxBuilder)
    .overrideGuard(SessionGuard)
    .useValue(mockSessionGuard)
    .overrideGuard(RbacGuard)
    .useValue(mockRbacGuard)
    .compile();

  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// =====================================================================
// Health / root
// =====================================================================
describe('GET /api (root)', () => {
  it('should return Hello World', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });
});

// =====================================================================
// Auth endpoints (no guard needed — auth controller has no SessionGuard)
// =====================================================================
describe('Auth /api/auth', () => {
  it('POST /api/auth/login — rejects invalid signature', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ address: '0xabc', signature: 'badsig', message: 'hello' });

    expect(res.status).toBe(401);
  });

  it('POST /api/auth/logout — clears cookies', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});

// =====================================================================
// Deals CRUD
// =====================================================================
describe('Deals /api/deals', () => {
  const sampleDeal = {
    id: 'deal-001',
    workspaceId: 'ws-001',
    profileId: 'profile-001',
    title: 'Big Deal',
    amountUsd: 10000,
    stage: 'prospecting',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('POST /api/deals — create deal', async () => {
    prisma.deal.create.mockResolvedValue(sampleDeal);

    const res = await request(app.getHttpServer())
      .post('/api/deals')
      .send({
        profileId: 'profile-001',
        title: 'Big Deal',
        amountUsd: 10000,
        stage: 'prospecting',
      })
      .expect(201);

    expect(res.body).toHaveProperty('txDigest', 'dry-run');
    expect(mockTxBuilder.buildCreateDealTx).toHaveBeenCalled();
  });

  it('GET /api/deals/:id — get single deal', async () => {
    prisma.deal.findUniqueOrThrow.mockResolvedValue(sampleDeal);

    const res = await request(app.getHttpServer())
      .get('/api/deals/deal-001')
      .expect(200);

    expect(res.body.id).toBe('deal-001');
  });

  it('GET /api/deals — list deals', async () => {
    prisma.deal.findMany.mockResolvedValue([sampleDeal]);
    prisma.deal.count.mockResolvedValue(1);

    const res = await request(app.getHttpServer())
      .get('/api/deals')
      .expect(200);

    expect(res.body.deals).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('PUT /api/deals/:id — update deal', async () => {
    prisma.deal.update.mockResolvedValue({ ...sampleDeal, title: 'Updated' });

    const res = await request(app.getHttpServer())
      .put('/api/deals/deal-001')
      .send({ title: 'Updated', expectedVersion: 1 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.txDigest).toBe('dry-run');
  });

  it('PUT /api/deals/:id/stage — update deal stage', async () => {
    prisma.deal.update.mockResolvedValue({
      ...sampleDeal,
      stage: 'closed-won',
    });

    const res = await request(app.getHttpServer())
      .put('/api/deals/deal-001/stage')
      .send({ stage: 'closed-won', expectedVersion: 1 })
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});

// =====================================================================
// Profiles CRUD
// =====================================================================
describe('Profiles /api/profiles', () => {
  const sampleProfile = {
    id: 'profile-001',
    workspaceId: 'ws-001',
    primaryAddress: '0xuser1',
    suinsName: null,
    tags: ['whale'],
    tier: 0,
    engagementScore: 0,
    version: 1,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('POST /api/profiles — create profile', async () => {
    prisma.profile.create.mockResolvedValue(sampleProfile);

    const res = await request(app.getHttpServer())
      .post('/api/profiles')
      .send({ primaryAddress: '0xuser1', tags: ['whale'] })
      .expect(201);

    expect(res.body).toHaveProperty('txDigest', 'dry-run');
  });

  it('GET /api/profiles/:id — get profile', async () => {
    prisma.profile.findUniqueOrThrow.mockResolvedValue(sampleProfile);

    const res = await request(app.getHttpServer())
      .get('/api/profiles/profile-001')
      .expect(200);

    expect(res.body.id).toBe('profile-001');
  });

  it('GET /api/profiles — list profiles', async () => {
    prisma.profile.findMany.mockResolvedValue([sampleProfile]);
    prisma.profile.count.mockResolvedValue(1);

    const res = await request(app.getHttpServer())
      .get('/api/profiles')
      .expect(200);

    expect(res.body.profiles).toHaveLength(1);
  });

  it('PUT /api/profiles/:id/tags — update tags', async () => {
    prisma.profile.update.mockResolvedValue({
      ...sampleProfile,
      tags: ['whale', 'vip'],
    });

    const res = await request(app.getHttpServer())
      .put('/api/profiles/profile-001/tags')
      .send({ tags: ['whale', 'vip'], expectedVersion: 1 })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('DELETE /api/profiles/:id — archive profile', async () => {
    prisma.profile.update.mockResolvedValue({
      ...sampleProfile,
      isArchived: true,
    });

    const res = await request(app.getHttpServer())
      .delete('/api/profiles/profile-001')
      .send({ expectedVersion: 1 })
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});

// =====================================================================
// Organizations CRUD
// =====================================================================
describe('Organizations /api/organizations', () => {
  const sampleOrg = {
    id: 'org-001',
    workspaceId: 'ws-001',
    name: 'Acme Corp',
    domain: 'acme.com',
    tags: ['enterprise'],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('POST /api/organizations — create org', async () => {
    prisma.organization.create.mockResolvedValue(sampleOrg);

    const res = await request(app.getHttpServer())
      .post('/api/organizations')
      .send({ name: 'Acme Corp', domain: 'acme.com', tags: ['enterprise'] })
      .expect(201);

    expect(res.body).toHaveProperty('txDigest', 'dry-run');
  });

  it('GET /api/organizations/:id — get org', async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue(sampleOrg);

    const res = await request(app.getHttpServer())
      .get('/api/organizations/org-001')
      .expect(200);

    expect(res.body.id).toBe('org-001');
  });

  it('GET /api/organizations — list orgs', async () => {
    prisma.organization.findMany.mockResolvedValue([sampleOrg]);
    prisma.organization.count.mockResolvedValue(1);

    const res = await request(app.getHttpServer())
      .get('/api/organizations')
      .expect(200);

    expect(res.body.organizations).toHaveLength(1);
  });

  it('PUT /api/organizations/:id — update org', async () => {
    prisma.organization.update.mockResolvedValue({
      ...sampleOrg,
      name: 'Acme Inc',
    });

    const res = await request(app.getHttpServer())
      .put('/api/organizations/org-001')
      .send({ name: 'Acme Inc', expectedVersion: 1 })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('POST /api/organizations/:orgId/profiles/:profileId — link profile', async () => {
    prisma.profileOrganization.create.mockResolvedValue({
      profileId: 'profile-001',
      organizationId: 'org-001',
    });

    const res = await request(app.getHttpServer())
      .post('/api/organizations/org-001/profiles/profile-001')
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.txDigest).toBe('dry-run');
  });
});

// =====================================================================
// Segments CRUD
// =====================================================================
describe('Segments /api/segments', () => {
  const sampleSegment = {
    id: 'seg-001',
    workspaceId: 'ws-001',
    name: 'Whales',
    description: 'High-value users',
    rules: { minBalance: 1000 },
    version: 1,
    lastRefreshedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('POST /api/segments — create segment', async () => {
    prisma.segment.create.mockResolvedValue(sampleSegment);

    const res = await request(app.getHttpServer())
      .post('/api/segments')
      .send({
        name: 'Whales',
        description: 'High-value users',
        rules: { minBalance: 1000 },
      })
      .expect(201);

    expect(res.body).toHaveProperty('txDigest', 'dry-run');
  });

  it('GET /api/segments/:id — get segment', async () => {
    prisma.segment.findUniqueOrThrow.mockResolvedValue(sampleSegment);

    const res = await request(app.getHttpServer())
      .get('/api/segments/seg-001')
      .expect(200);

    expect(res.body.id).toBe('seg-001');
  });

  it('GET /api/segments — list segments', async () => {
    prisma.segment.findMany.mockResolvedValue([sampleSegment]);
    prisma.segment.count.mockResolvedValue(1);

    const res = await request(app.getHttpServer())
      .get('/api/segments')
      .expect(200);

    expect(res.body.segments).toHaveLength(1);
  });

  it('PUT /api/segments/:id — update segment', async () => {
    prisma.segment.update.mockResolvedValue({
      ...sampleSegment,
      name: 'Super Whales',
    });

    const res = await request(app.getHttpServer())
      .put('/api/segments/seg-001')
      .send({ name: 'Super Whales', expectedVersion: 1 })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('GET /api/segments/:id/profiles — evaluate segment', async () => {
    prisma.segmentMembership.findMany.mockResolvedValue([]);
    prisma.segmentMembership.count.mockResolvedValue(0);
    // Some services might call segment.findUniqueOrThrow first
    prisma.segment.findUniqueOrThrow.mockResolvedValue(sampleSegment);

    const res = await request(app.getHttpServer())
      .get('/api/segments/seg-001/profiles')
      .expect(200);

    // Response shape depends on service implementation
    expect(res.status).toBe(200);
  });
});

// =====================================================================
// 401 — Verify SessionGuard blocks when no token
// Uses a separate app with a mock guard that rejects (simulates missing token)
// =====================================================================
describe('Auth guard rejection', () => {
  let strictApp: INestApplication<App>;

  const rejectingGuard = {
    canActivate: () => {
      throw new UnauthorizedException('No access token provided');
    },
  };

  beforeAll(async () => {
    const prismaMock = buildPrismaMock();

    const mod = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(SuiClientService)
      .useValue(mockSuiClient)
      .overrideProvider(TxBuilderService)
      .useValue(mockTxBuilder)
      .overrideGuard(SessionGuard)
      .useValue(rejectingGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockRbacGuard)
      .compile();

    strictApp = mod.createNestApplication();
    strictApp.setGlobalPrefix('api');
    await strictApp.init();
  });

  afterAll(async () => {
    await strictApp.close();
  });

  it('GET /api/deals — returns 401 without token', () => {
    return request(strictApp.getHttpServer()).get('/api/deals').expect(401);
  });

  it('POST /api/deals — returns 401 without token', () => {
    return request(strictApp.getHttpServer())
      .post('/api/deals')
      .send({ profileId: 'p1', title: 't', amountUsd: 1, stage: 's' })
      .expect(401);
  });
});
