export class SuiJsonRpcClient {
  constructor(_opts: any) {}
  async signAndExecuteTransaction(_opts: any) {
    return {
      digest: 'mock',
      events: [],
      effects: { status: { status: 'success' } },
      objectChanges: [],
    };
  }
  async getObject(_opts: any) {
    return {};
  }
  async multiGetObjects(_opts: any) {
    return [];
  }
  async queryEvents(_query: any) {
    return { data: [] };
  }
}
