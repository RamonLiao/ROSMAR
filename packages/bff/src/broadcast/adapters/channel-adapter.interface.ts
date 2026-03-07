export interface ChannelAdapter {
  readonly channel: string;
  send(content: string, config: Record<string, any>): Promise<{ messageId: string }>;
}
