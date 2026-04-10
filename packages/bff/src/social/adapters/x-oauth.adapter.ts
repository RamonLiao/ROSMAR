import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface XUser {
  id: string;
  username: string;
}

@Injectable()
export class XOAuthAdapter {
  private readonly clientId: string;
  private readonly redirectUri: string;

  constructor(private config: ConfigService) {
    this.clientId = this.config.get<string>('X_CLIENT_ID', 'x-client-id');
    this.redirectUri = this.config.get<string>(
      'X_REDIRECT_URI',
      'http://localhost:3001/api/social/x/callback',
    );
  }

  getAuthUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'tweet.read users.read offline.access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `https://x.com/i/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<string> {
    const res = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`X token exchange failed: ${err}`);
    }

    const data = await res.json();
    return data.access_token;
  }

  async getUserInfo(accessToken: string): Promise<XUser> {
    const res = await fetch('https://api.x.com/2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error('Failed to fetch X user info');
    }

    const data = await res.json();
    return { id: data.data.id, username: data.data.username };
  }
}
