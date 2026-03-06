import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, IsOptional, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  priority?: string;

  @IsString()
  @IsOptional()
  assignee?: string;

  @IsDateString()
  @IsOptional()
  slaDeadline?: string;
}

export class UpdateTicketDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  priority?: string;

  @IsString()
  @IsOptional()
  assignee?: string;

  @IsDateString()
  @IsOptional()
  slaDeadline?: string;
}

@Injectable()
export class TicketService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateTicketDto) {
    return this.prisma.ticket.create({
      data: {
        workspaceId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority || 'medium',
        assignee: dto.assignee,
        slaDeadline: dto.slaDeadline ? new Date(dto.slaDeadline) : undefined,
      },
    });
  }

  async list(workspaceId: string) {
    return this.prisma.ticket.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto) {
    return this.prisma.ticket.update({
      where: { id },
      data: {
        ...dto,
        slaDeadline: dto.slaDeadline ? new Date(dto.slaDeadline) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.ticket.delete({ where: { id } });
    return { success: true };
  }
}
