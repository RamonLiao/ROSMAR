import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TicketService, CreateTicketDto, UpdateTicketDto } from './ticket.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE, READ, DELETE } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import type { UserPayload } from '../auth/auth.service';

@Controller('tickets')
@UseGuards(SessionGuard, RbacGuard)
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  @RequirePermissions(WRITE)
  async create(@User() user: UserPayload, @Body() dto: CreateTicketDto) {
    return this.ticketService.create(user.workspaceId, dto);
  }

  @Get()
  @RequirePermissions(READ)
  async list(@User() user: UserPayload) {
    return this.ticketService.list(user.workspaceId);
  }

  @Get(':id')
  @RequirePermissions(READ)
  async findOne(@Param('id') id: string) {
    return this.ticketService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(WRITE)
  async update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(DELETE)
  async remove(@Param('id') id: string) {
    return this.ticketService.remove(id);
  }
}
