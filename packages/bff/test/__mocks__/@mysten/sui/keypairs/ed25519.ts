export class Ed25519PublicKey {
  constructor(_address: string) {}
  async verify(_message: Uint8Array, _signature: Uint8Array): Promise<boolean> {
    return false;
  }
  toSuiAddress(): string {
    return '0xmock';
  }
}

export class Ed25519Keypair {
  static fromSecretKey(_key: Uint8Array): Ed25519Keypair {
    return new Ed25519Keypair();
  }
  getPublicKey() {
    return new Ed25519PublicKey('0xmock');
  }
}
