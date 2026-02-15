import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ScoreBucket {
  range: string;
  count: number;
}

export interface ActivityCell {
  day: string;
  hour: number;
  activity: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getScoreDistribution(workspaceId: string): Promise<ScoreBucket[]> {
    const rows = await this.prisma.$queryRaw<
      { bucket: string; count: bigint }[]
    >`
      SELECT
        CASE
          WHEN "engagementScore" <= 20 THEN '0-20'
          WHEN "engagementScore" <= 40 THEN '21-40'
          WHEN "engagementScore" <= 60 THEN '41-60'
          WHEN "engagementScore" <= 80 THEN '61-80'
          ELSE '81-100'
        END AS bucket,
        COUNT(*) AS count
      FROM "Profile"
      WHERE "workspaceId" = ${workspaceId} AND "isArchived" = false
      GROUP BY bucket
      ORDER BY bucket
    `;

    const bucketMap = new Map(rows.map((r) => [r.bucket, Number(r.count)]));
    const ranges = ['0-20', '21-40', '41-60', '61-80', '81-100'];
    return ranges.map((range) => ({ range, count: bucketMap.get(range) ?? 0 }));
  }

  async getActivityHeatmap(workspaceId: string): Promise<ActivityCell[]> {
    // Aggregate creation timestamps from profiles and deals via DB-side grouping
    const rows = await this.prisma.$queryRaw<
      { dow: number; hour: number; count: bigint }[]
    >`
      SELECT EXTRACT(DOW FROM "createdAt") AS dow,
             EXTRACT(HOUR FROM "createdAt") AS hour,
             COUNT(*) AS count
      FROM (
        SELECT "createdAt" FROM "Profile" WHERE "workspaceId" = ${workspaceId}
        UNION ALL
        SELECT "createdAt" FROM "Deal" WHERE "workspaceId" = ${workspaceId}
      ) combined
      GROUP BY dow, hour
      ORDER BY dow, hour
    `;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const grid = new Map<string, number>();
    for (const row of rows) {
      grid.set(`${Number(row.dow)}-${Number(row.hour)}`, Number(row.count));
    }

    const result: ActivityCell[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        result.push({
          day: days[d],
          hour: h,
          activity: grid.get(`${d}-${h}`) ?? 0,
        });
      }
    }

    return result;
  }
}
