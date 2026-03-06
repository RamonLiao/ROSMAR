import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WalrusUploadResponse {
  blobId: string;
  url: string;
}

@Injectable()
export class WalrusClient {
  private readonly logger = new Logger(WalrusClient.name);
  private publisherUrl: string;
  private aggregatorUrl: string;
  private isMock: boolean;

  constructor(private readonly configService: ConfigService) {
    this.publisherUrl = this.configService.get<string>(
      'WALRUS_PUBLISHER_URL',
      'https://publisher.walrus-testnet.walrus.space',
    );
    this.aggregatorUrl = this.configService.get<string>(
      'WALRUS_AGGREGATOR_URL',
      'https://aggregator.walrus-testnet.walrus.space',
    );
    this.isMock = this.configService.get<string>('WALRUS_MOCK', 'true') === 'true';
  }

  async uploadBlob(data: Buffer): Promise<WalrusUploadResponse> {
    if (this.isMock) {
      const mockBlobId = `blob_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      this.logger.log(`[MOCK] Uploaded blob (${data.length} bytes) → ${mockBlobId}`);
      return {
        blobId: mockBlobId,
        url: `${this.aggregatorUrl}/v1/${mockBlobId}`,
      };
    }

    const response = await fetch(`${this.publisherUrl}/v1/store`, {
      method: 'PUT',
      body: new Uint8Array(data),
      headers: { 'Content-Type': 'application/octet-stream' },
    });

    if (!response.ok) {
      throw new Error(`Walrus upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const blobId =
      result.newlyCreated?.blobObject?.blobId ??
      result.alreadyCertified?.blobId;

    if (!blobId) {
      throw new Error('Walrus upload response missing blobId');
    }

    return {
      blobId,
      url: `${this.aggregatorUrl}/v1/${blobId}`,
    };
  }

  async downloadBlob(blobId: string): Promise<Buffer> {
    if (this.isMock) {
      this.logger.log(`[MOCK] Downloading blob: ${blobId}`);
      return Buffer.from('mock blob data');
    }

    const response = await fetch(`${this.aggregatorUrl}/v1/${blobId}`);
    if (!response.ok) {
      throw new Error(`Walrus download failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getBlobInfo(blobId: string): Promise<any> {
    if (this.isMock) {
      return { blobId, size: 1024, certified: true };
    }

    const response = await fetch(`${this.aggregatorUrl}/v1/${blobId}/info`);
    return response.json();
  }
}
