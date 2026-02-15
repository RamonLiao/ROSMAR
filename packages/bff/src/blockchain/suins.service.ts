import { Injectable } from '@nestjs/common';
import { SuiClientService } from './sui.client';

@Injectable()
export class SuinsService {
  constructor(private suiClient: SuiClientService) {}

  /**
   * Resolve .sui name to address
   */
  async resolveNameToAddress(name: string): Promise<string | null> {
    try {
      const client = this.suiClient.getClient();

      // Query SuiNS registry for the name
      // TODO: Implement actual SuiNS resolution using official SDK
      // For now, mock implementation

      // SuiNS names are stored in a registry contract
      // We would query the registry with the name hash

      return null; // Return null if not found
    } catch (error) {
      console.error('Error resolving SuiNS name:', error);
      return null;
    }
  }

  /**
   * Reverse resolve address to .sui name
   */
  async resolveAddressToName(address: string): Promise<string | null> {
    try {
      const client = this.suiClient.getClient();

      // Query SuiNS reverse registry
      // TODO: Implement actual reverse resolution

      return null;
    } catch (error) {
      console.error('Error reverse resolving address:', error);
      return null;
    }
  }

  /**
   * Check if a .sui name is available
   */
  async isNameAvailable(name: string): Promise<boolean> {
    const address = await this.resolveNameToAddress(name);
    return address === null;
  }

  /**
   * Normalize .sui name (lowercase, remove .sui suffix if present)
   */
  normalizeName(name: string): string {
    return name.toLowerCase().replace(/\.sui$/, '');
  }
}
