import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';

@Injectable()
export class RustCoreClient implements OnModuleInit {
  private profileService: any;
  private segmentService: any;
  private analyticsService: any;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const grpcUrl = this.configService.get<string>(
      'RUST_CORE_GRPC',
      'localhost:50051',
    );

    // Load proto file
    const protoPath = join(__dirname, '../../../proto/core.proto');
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const crmCore = (protoDescriptor.crm as any).core;

    // Create gRPC clients
    this.profileService = new crmCore.ProfileService(
      grpcUrl,
      grpc.credentials.createInsecure(),
    );

    this.segmentService = new crmCore.SegmentService(
      grpcUrl,
      grpc.credentials.createInsecure(),
    );

    this.analyticsService = new crmCore.AnalyticsService(
      grpcUrl,
      grpc.credentials.createInsecure(),
    );
  }

  /**
   * List profiles with pagination and filters
   */
  async listProfiles(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.profileService.ListProfiles(request, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Get single profile by ID
   */
  async getProfile(profileId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.profileService.GetProfile(
        { id: profileId },
        (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  /**
   * Get activity feed for profile (streaming)
   */
  getActivityFeed(request: any): any {
    return this.profileService.GetActivityFeed(request);
  }

  /**
   * Search profiles and organizations
   */
  async search(
    workspaceId: string,
    query: string,
    limit: number,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.profileService.Search(
        { workspace_id: workspaceId, query, limit },
        (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  /**
   * Evaluate segment rules and get matching profiles
   */
  async evaluateSegment(segmentId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.segmentService.EvaluateSegment(
        { segment_id: segmentId },
        (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  /**
   * Get segment members
   */
  async getSegmentMembers(
    segmentId: string,
    page: number,
    pageSize: number,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.segmentService.GetSegmentMembers(
        { segment_id: segmentId, page, page_size: pageSize },
        (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  /**
   * Get dashboard overview stats
   */
  async getDashboardOverview(workspaceId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.analyticsService.GetDashboardOverview(
        { workspace_id: workspaceId },
        (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  /**
   * Recalculate engagement scores
   */
  async recalculateScores(workspaceId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.analyticsService.RecalculateScores(
        { workspace_id: workspaceId },
        (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  /**
   * Stream whale alerts
   */
  checkWhaleAlert(workspaceId: string): any {
    return this.analyticsService.CheckWhaleAlert({ workspace_id: workspaceId });
  }
}
