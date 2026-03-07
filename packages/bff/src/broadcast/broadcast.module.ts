import { Module } from '@nestjs/common';
import { BroadcastService } from './broadcast.service';
import { BroadcastController } from './broadcast.controller';
import { ChannelAdapterRegistry } from './adapters/channel-adapter.registry';
import { TelegramChannelAdapter } from './adapters/telegram-channel.adapter';
import { DiscordChannelAdapter } from './adapters/discord-channel.adapter';
import { XChannelAdapter } from './adapters/x-channel.adapter';

@Module({
  controllers: [BroadcastController],
  providers: [
    BroadcastService,
    ChannelAdapterRegistry,
    TelegramChannelAdapter,
    DiscordChannelAdapter,
    XChannelAdapter,
  ],
  exports: [BroadcastService],
})
export class BroadcastModule {}
