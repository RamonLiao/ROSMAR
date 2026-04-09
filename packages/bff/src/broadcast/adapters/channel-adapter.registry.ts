import { Injectable } from '@nestjs/common';
import type { ChannelAdapter } from './channel-adapter.interface';
import { TelegramChannelAdapter } from './telegram-channel.adapter';
import { DiscordChannelAdapter } from './discord-channel.adapter';
import { XChannelAdapter } from './x-channel.adapter';
import { EmailChannelAdapter } from './email-channel.adapter';

@Injectable()
export class ChannelAdapterRegistry {
  private adapters = new Map<string, ChannelAdapter>();

  constructor(
    private readonly telegram: TelegramChannelAdapter,
    private readonly discord: DiscordChannelAdapter,
    private readonly x: XChannelAdapter,
    private readonly email: EmailChannelAdapter,
  ) {
    this.register(telegram);
    this.register(discord);
    this.register(x);
    this.register(email);
  }

  register(adapter: ChannelAdapter) {
    this.adapters.set(adapter.channel, adapter);
  }

  get(channel: string): ChannelAdapter | undefined {
    return this.adapters.get(channel);
  }

  getAll(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }
}
