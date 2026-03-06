import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateNotificationDto {
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  metadata?: any;
}

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({ data: dto });
  }

  async list(workspaceId: string, userId: string, limit = 30) {
    return this.prisma.notification.findMany({
      where: { workspaceId, userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(workspaceId: string, userId: string) {
    return this.prisma.notification.count({
      where: { workspaceId, userId, isRead: false },
    });
  }

  async markRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(workspaceId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { workspaceId, userId, isRead: false },
      data: { isRead: true },
    });
  }
}
