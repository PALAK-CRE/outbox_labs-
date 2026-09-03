import { Client } from '@elastic/elasticsearch';
import { ENV } from './env.js';

let esClient: Client | null = null;
let isElasticsearchConnected = false;

export function getElasticsearchClient(): Client | null {
  if (!esClient) {
    try {
      esClient = new Client({
        node: ENV.ELASTICSEARCH_NODE,
        requestTimeout: 3000,
        maxRetries: 2,
      });
    } catch (err: any) {
      console.warn('⚠️ Elasticsearch Client initialization error:', err.message);
      esClient = null;
    }
  }
  return esClient;
}

export async function initElasticsearch() {
  const client = getElasticsearchClient();
  if (!client) return;

  try {
    const health = await client.cluster.health({});
    isElasticsearchConnected = true;
    console.log(`✅ Elasticsearch Connected at ${ENV.ELASTICSEARCH_NODE} (Status: ${health.status})`);

    const indexExists = await client.indices.exists({ index: ENV.ELASTICSEARCH_INDEX });
    if (!indexExists) {
      await client.indices.create({
        index: ENV.ELASTICSEARCH_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              batchId: { type: 'keyword' },
              senderEmail: { type: 'keyword' },
              recipientEmail: { type: 'keyword' },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      console.log(`✅ Elasticsearch index '${ENV.ELASTICSEARCH_INDEX}' created successfully`);
    }
  } catch (error: any) {
    isElasticsearchConnected = false;
    console.warn(`⚠️ Elasticsearch is unreachable at ${ENV.ELASTICSEARCH_NODE}. Search fallback to database full-text is enabled.`);
  }
}

export function isESAvailable(): boolean {
  return isElasticsearchConnected;
}
