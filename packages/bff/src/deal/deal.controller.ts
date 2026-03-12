import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DealService } from './deal.service';
import { DealDocumentService } from './deal-document.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE, DELETE } from '../auth/guards/rbac.guard';
import { DealRoomGuard } from './deal-room.guard';
import { User } from '../auth/decorators/user.decorator';
// UserPayload used inline as import() type in decorated params to avoid isolatedModules error

export class CreateDealDto {
  profileId: string;
  title: string;
  amountUsd: number;
  stage: string;
  notes?: string;
}

export class UpdateDealDto {
  title?: string;
  amountUsd?: number;
  stage?: string;
  notes?: string;
  expectedVersion: number;
}

export class UploadDocumentBodyDto {
  name: string;
  encryptedData: string;
  sealPolicyId?: string;
  mimeType?: string;
  fileSize?: number;
}

@Controller('deals')
@UseGuards(SessionGuard, RbacGuard)
export class DealController {
  constructor(
    private readonly dealService: DealService,
    private readonly dealDocumentService: DealDocumentService,
    private readonly dealRoomGuard: DealRoomGuard,
  ) {}

  @Post()
  @RequirePermissions(WRITE)
  async create(
    @User() user: import('../auth/auth.service').UserPayload,
    @Body() dto: import('./deal.controller').CreateDealDto,
  ) {
    return this.dealService.create(
      user.workspaceId,
      user.address,
      dto,
    );
  }

  @Get(':id')
  async getDeal(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    return this.dealService.getDeal(user.workspaceId, id);
  }

  @Get()
  async listDeals(
    @User() user: import('../auth/auth.service').UserPayload,
    @Query('profileId') profileId?: string,
    @Query('stage') stage?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.dealService.listDeals(
      user.workspaceId,
      profileId,
      stage,
      limit || 50,
      offset || 0,
    );
  }

  @Put(':id')
  @RequirePermissions(WRITE)
  async update(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
    @Body() dto: import('./deal.controller').UpdateDealDto,
  ) {
    return this.dealService.update(
      user.workspaceId,
      user.address,
      id,
      dto,
    );
  }

  @Put(':id/stage')
  @RequirePermissions(WRITE)
  async updateStage(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
    @Body('stage') stage: string,
    @Body('expectedVersion') expectedVersion: number,
  ) {
    return this.dealService.updateStage(
      user.workspaceId,
      user.address,
      id,
      stage,
      expectedVersion,
    );
  }

  @Put(':id/archive')
  @RequirePermissions(WRITE)
  async archive(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
    @Body('expectedVersion') expectedVersion: number,
  ) {
    return this.dealService.archive(
      user.workspaceId,
      user.address,
      id,
      expectedVersion,
    );
  }

  @Get(':id/audit')
  async getAuditLogs(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    return this.dealService.getAuditLogs(user.workspaceId, id);
  }

  // --- Deal Room Access Check ---

  @Get(':id/access')
  async checkAccess(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    if (user.role >= 3) {
      return { hasAccess: true };
    }
    try {
      const participants = await this.dealRoomGuard.gatherParticipants(
        id,
        user.workspaceId,
      );
      return { hasAccess: participants.has(user.address) };
    } catch {
      return { hasAccess: false };
    }
  }

  // --- Deal Documents (gated by DealRoomGuard) ---

  @Post(':id/documents')
  @UseGuards(DealRoomGuard)
  @RequirePermissions(WRITE)
  async uploadDocument(
    @Param('id') dealId: string,
    @Body() body: UploadDocumentBodyDto,
    @User() user: import('../auth/auth.service').UserPayload,
  ) {
    return this.dealDocumentService.uploadDocument(
      user.workspaceId,
      user.address,
      { dealId, ...body },
    );
  }

  @Get(':id/documents')
  @UseGuards(DealRoomGuard)
  async listDocuments(
    @Param('id') dealId: string,
    @User() user: import('../auth/auth.service').UserPayload,
  ) {
    return this.dealDocumentService.listDocuments(
      user.workspaceId,
      user.address,
      dealId,
    );
  }

  @Delete('documents/:docId')
  @RequirePermissions(DELETE)
  async deleteDocument(
    @Param('docId') docId: string,
    @Body('expectedVersion') expectedVersion: number,
    @User() user: import('../auth/auth.service').UserPayload,
  ) {
    return this.dealDocumentService.deleteDocument(
      user.workspaceId,
      docId,
      expectedVersion,
    );
  }
}
