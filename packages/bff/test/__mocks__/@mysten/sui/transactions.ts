export class Transaction {
  moveCall(_opts: any) { return this; }
  object(_id: string) { return {}; }
  pure = {
    string: (_v: string) => ({}),
    u8: (_v: number) => ({}),
    u64: (_v: number) => ({}),
    address: (_v: string) => ({}),
    option: (_type: string, _v: any) => ({}),
    vector: (_type: string, _v: any[]) => ({}),
  };
}
