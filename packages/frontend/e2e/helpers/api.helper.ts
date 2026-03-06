const API = process.env.API_URL || 'http://localhost:3001/api';

export class ApiHelper {
  private cookies: string = '';

  async login(address?: string): Promise<void> {
    const res = await fetch(`${API}/auth/test-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    if (!res.ok) throw new Error(`test-login failed: ${res.status}`);
    const setCookies = res.headers.getSetCookie();
    this.cookies = setCookies.map((c) => c.split(';')[0]).join('; ');
  }

  getCookies(): { name: string; value: string; domain: string; path: string }[] {
    return this.cookies.split('; ').map((c) => {
      const [name, ...rest] = c.split('=');
      return { name, value: rest.join('='), domain: 'localhost', path: '/' };
    });
  }

  private async request(method: string, path: string, body?: unknown) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Cookie: this.cookies,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  // Profiles
  createProfile(data: { primaryAddress: string; suinsName?: string; tags?: string[] }) {
    return this.request('POST', '/profiles', data);
  }
  listProfiles() {
    return this.request('GET', '/profiles');
  }

  // Organizations
  createOrganization(data: { name: string; domain?: string; tags?: string[] }) {
    return this.request('POST', '/organizations', data);
  }
  linkProfile(orgId: string, profileId: string) {
    return this.request('POST', `/organizations/${orgId}/profiles/${profileId}`);
  }

  // Deals
  createDeal(data: { profileId: string; title: string; amountUsd: number; stage: string; notes?: string }) {
    return this.request('POST', '/deals', data);
  }

  // Segments
  createSegment(data: { name: string; description?: string; rules: unknown }) {
    return this.request('POST', '/segments', data);
  }

  // Campaigns
  createCampaign(data: { name: string; segmentId: string; workflowSteps: unknown[] }) {
    return this.request('POST', '/campaigns', data);
  }

  // Tickets
  createTicket(data: { title: string; priority?: string; assignee?: string; slaDeadline?: string }) {
    return this.request('POST', '/tickets', data);
  }
}
