import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateSaftTemplateInput {
  name: string;
  terms: Record<string, any>;
}

@Injectable()
export class SaftTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateSaftTemplateInput) {
    return this.prisma.saftTemplate.create({
      data: {
        workspaceId,
        name: dto.name,
        terms: dto.terms,
      },
    });
  }

  async list(workspaceId: string) {
    return this.prisma.saftTemplate.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async attachToEscrow(templateId: string, escrowId: string) {
    const template = await this.prisma.saftTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new NotFoundException('SAFT template not found');

    return this.prisma.saftTemplate.update({
      where: { id: templateId },
      data: { escrowId },
    });
  }

  async uploadSigned(templateId: string, walrusBlobId: string) {
    const template = await this.prisma.saftTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new NotFoundException('SAFT template not found');

    return this.prisma.saftTemplate.update({
      where: { id: templateId },
      data: { walrusBlobId },
    });
  }
}
