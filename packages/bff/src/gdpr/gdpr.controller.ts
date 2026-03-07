import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard';
import { GdprService } from './gdpr.service';
import { GdprExportService } from './gdpr-export.service';

@Controller('profiles')
@UseGuards(SessionGuard)
export class GdprController {
  constructor(
    private readonly gdprService: GdprService,
    private readonly gdprExportService: GdprExportService,
  ) {}

  @Delete(':id/gdpr')
  async initiateDeletion(
    @Param('id') profileId: string,
    @Body() body: { legalBasis: string; requestedBy: string; workspaceId: string },
  ) {
    await this.gdprService.initiateDeletion(
      body.workspaceId,
      profileId,
      body.requestedBy,
      body.legalBasis,
    );
    return { message: 'Deletion scheduled', profileId };
  }

  @Get(':id/gdpr/status')
  async getStatus(@Param('id') profileId: string) {
    return this.gdprService.getStatus(profileId);
  }

  @Post(':id/gdpr/cancel')
  async cancelDeletion(@Param('id') profileId: string) {
    await this.gdprService.cancelDeletion(profileId);
    return { message: 'Deletion cancelled', profileId };
  }

  @Get(':id/export')
  async exportProfile(@Param('id') profileId: string) {
    return this.gdprExportService.export(profileId);
  }
}
