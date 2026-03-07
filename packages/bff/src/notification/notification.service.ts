import { Injectable, Logger } from '@nestjs/common';

export interface CreateNotificationDto {
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface Notification extends CreateNotificationDto {
  id: string;
  isRead: boolean;
  createdAt: Date;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly notifications: Notification[] = [];

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification: Notification = {
      ...dto,
      id: crypto.randomUUID(),
      isRead: false,
      createdAt: new Date(),
    };

    this.notifications.push(notification);
    this.logger.log(`Notification created: [${dto.type}] ${dto.title}`);

    // TODO: Persist to DB when Notification model is added to schema
    // TODO: Push via WebSocket/SSE for real-time delivery

    return notification;
  }

  async findByUser(userId: string, limit = 20): Promise<Notification[]> {
    return this.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async markRead(id: string): Promise<void> {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification) {
      notification.isRead = true;
    }
  }

  async markAllRead(userId: string): Promise<void> {
    this.notifications
      .filter((n) => n.userId === userId && !n.isRead)
      .forEach((n) => {
        n.isRead = true;
      });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notifications.filter((n) => n.userId === userId && !n.isRead).length;
  }
}
