import { getElasticsearchClient, isESAvailable } from '../config/elasticsearch.js';
import { ENV } from '../config/env.js';
import { prisma } from '../config/prisma.js';

export interface EmailSearchQuery {
  query?: string;
  status?: string;
  userId?: string;
  senderEmail?: string;
  page?: number;
  limit?: number;
}

export class SearchService {
  /**
   * Index or update an email document in Elasticsearch
   */
  public static async indexEmail(email: {
    id: string;
    userId: string;
    batchId?: string | null;
    senderEmail: string;
    recipientEmail: string;
    subject: string;
    body: string;
    status: string;
    scheduledAt: Date;
    sentAt?: Date | null;
    createdAt?: Date;
  }) {
    const client = getElasticsearchClient();
    if (!client || !isESAvailable()) return;

    try {
      await client.index({
        index: ENV.ELASTICSEARCH_INDEX,
        id: email.id,
        document: {
          id: email.id,
          userId: email.userId,
          batchId: email.batchId || null,
          senderEmail: email.senderEmail,
          recipientEmail: email.recipientEmail,
          subject: email.subject,
          body: email.body,
          status: email.status,
          scheduledAt: email.scheduledAt.toISOString(),
          sentAt: email.sentAt ? email.sentAt.toISOString() : null,
          createdAt: (email.createdAt || new Date()).toISOString(),
        },
      });
    } catch (err: any) {
      console.warn(`⚠️ Elasticsearch indexing error for email ${email.id}:`, err.message);
    }
  }

  /**
   * Search emails across Elasticsearch or fallback to database
   */
  public static async searchEmails(params: EmailSearchQuery) {
    const client = getElasticsearchClient();
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const from = (page - 1) * limit;

    if (client && isESAvailable() && params.query && params.query.trim().length > 0) {
      try {
        const mustClauses: any[] = [];

        if (params.userId) {
          mustClauses.push({ term: { userId: params.userId } });
        }
        if (params.status) {
          mustClauses.push({ term: { status: params.status } });
        }
        if (params.senderEmail) {
          mustClauses.push({ term: { senderEmail: params.senderEmail } });
        }

        mustClauses.push({
          multi_match: {
            query: params.query,
            fields: ['subject^3', 'body^2', 'recipientEmail^4', 'senderEmail^2'],
            fuzziness: 'AUTO',
          },
        });

        const result = await client.search({
          index: ENV.ELASTICSEARCH_INDEX,
          from,
          size: limit,
          query: {
            bool: {
              must: mustClauses,
            },
          },
          sort: [{ scheduledAt: { order: 'desc' } }],
        });

        const total = typeof result.hits.total === 'number' ? result.hits.total : (result.hits.total?.value || 0);
        const hits = result.hits.hits.map((h: any) => h._source);

        return {
          source: 'elasticsearch',
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          data: hits,
        };
      } catch (esErr: any) {
        console.warn('⚠️ ES search failed, falling back to database query:', esErr.message);
      }
    }

    // Database Fallback Query
    const whereClause: any = {};
    if (params.userId) whereClause.userId = params.userId;
    if (params.status) whereClause.status = params.status as any;
    if (params.senderEmail) whereClause.senderEmail = params.senderEmail;

    if (params.query && params.query.trim().length > 0) {
      const q = params.query.trim();
      whereClause.OR = [
        { recipientEmail: { contains: q, mode: 'insensitive' } },
        { senderEmail: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.emailJob.count({ where: whereClause }),
      prisma.emailJob.findMany({
        where: whereClause,
        orderBy: { scheduledAt: 'desc' },
        skip: from,
        take: limit,
      }),
    ]);

    return {
      source: isESAvailable() ? 'elasticsearch-sync' : 'database-fallback',
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }
}
