export class EnokiClient {
  constructor(_opts: any) {}
  async createSponsoredTransaction(_opts: any) {
    return { bytes: '', digest: 'mock-digest' };
  }
  async executeSponsoredTransaction(_opts: any) {
    return { digest: 'mock-digest' };
  }
}

export class EnokiClientError extends Error {
  constructor(message: string) {
    super(message);
  }
}
