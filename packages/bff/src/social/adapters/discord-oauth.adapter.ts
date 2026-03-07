import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
}

@Injectable()
export class DiscordOAuthAdapter {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private config: ConfigService) {
    this.clientId = this.config.get<string>('DISCORD_CLIENT_ID', 'discord-client-id');
    this.clientSecret = this.config.get<string>('DISCORD_CLIENT_SECRET', 'discord-secret');
    this.redirectUri = this.config.get<string>('DISCORD_REDIRECT_URI', 'http://localhost:3001/api/social/discord/callback');
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
    });
    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<string> {
    const res = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Discord token exchange failed: ${err}`);
    }

    const data = await res.json();
    return data.access_token;
  }

  async getUserInfo(accessToken: string): Promise<DiscordUser> {
    const res = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error('Failed to fetch Discord user info');
    }

    const data = await res.json();
    return { id: data.id, username: data.username, avatar: data.avatar };
  }
}
