import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SaftTemplateService } from './saft-template.service';
import { SessionGuard } from '../auth/guards/session.guard';
import {
  RbacGuard,
  RequirePermissions,
  WRITE,
} from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import {
  CreateSaftTemplateDto,
  AttachSaftDto,
  UploadSignedSaftDto,
} from './dto/escrow-action.dto';

@Controller('saft-templates')
@UseGuards(SessionGuard, RbacGuard)
export class SaftTemplateController {
  constructor(private readonly saftService: SaftTemplateService) {}

  @Post()
  @RequirePermissions(WRITE)
  async create(
    @User() user: import('../auth/auth.service').UserPayload,
    @Body() dto: CreateSaftTemplateDto,
  ) {
    return this.saftService.create(user.workspaceId, dto);
  }

  @Get()
  async list(@User() user: import('../auth/auth.service').UserPayload) {
    return this.saftService.list(user.workspaceId);
  }

  @Put(':id/attach')
  @RequirePermissions(WRITE)
  async attach(@Param('id') id: string, @Body() dto: AttachSaftDto) {
    return this.saftService.attachToEscrow(id, dto.escrowId);
  }

  @Put(':id/upload')
  @RequirePermissions(WRITE)
  async upload(@Param('id') id: string, @Body() dto: UploadSignedSaftDto) {
    return this.saftService.uploadSigned(id, dto.walrusBlobId);
  }
}
