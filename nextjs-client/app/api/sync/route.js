import { Client, Databases, Query } from 'node-appwrite';
import { QdrantClient } from '@qdrant/js-client-rest';
import axios from 'axios';

/**
 * GET /api/sync
 *
 * This route is called automatically by a cron job (Vercel Cron or
 * an external service like cron-job.org) every hour.
 *
 * Flow:
 *   1. Connect to Appwrite and fetch all documents from the
 *      'rec_knowledge' collection (this is where NREP staff add
 *      new REC conference content via the Appwrite console).
 *   2. For each document, generate an embedding using nomic-embed-text
 *      via Ollama.
 *   3. Upsert the embeddings into Qdrant so the chatbot can
 *      immediately answer questions using the new data.
 *
 * No code changes are ever needed to add new REC editions —
 * staff just add a document in Appwrite and this route does the rest.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'rec_conference';
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'recbrain_db';
const APPWRITE_KNOWLEDGE_COLLECTION_ID =
  process.env.APPWRITE_KNOWLEDGE_COLLECTION_ID || 'rec_knowledge';

async function embedText(text) {
  const res = await axios.post(`${OLLAMA_URL}/api/embeddings`, {
    model: 'nomic-embed-text',
    prompt: text,
  });
  return res.data.embedding;
}

export async function GET(request) {
  // Optional: protect this route with a secret so randoms can't trigger it
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.SYNC_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    // 1. Connect to Appwrite
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);

    // 2. Fetch all REC knowledge documents from Appwrite
    //    (paginate in batches of 100 in case there are many documents)
    let allDocs = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const response = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_KNOWLEDGE_COLLECTION_ID,
        [Query.limit(limit), Query.offset(offset)]
      );
      allDocs = allDocs.concat(response.documents);
      if (response.documents.length < limit) break;
      offset += limit;
    }

    if (allDocs.length === 0) {
      return Response.json({
        synced: 0,
        message: 'No documents found in rec_knowledge collection.',
        timestamp: new Date().toISOString(),
      });
    }

    // 3. Connect to Qdrant
    const qdrant = new QdrantClient({ url: QDRANT_URL });

    // Make sure the collection exists
    try {
      await qdrant.getCollection(QDRANT_COLLECTION);
    } catch {
      await qdrant.createCollection(QDRANT_COLLECTION, {
        vectors: { size: 768, distance: 'Cosine' },
      });
    }

    // 4. Embed each document and prepare Qdrant points
    const points = [];
    const errors = [];

    for (const doc of allDocs) {
      try {
        const text = doc.text || '';
        if (!text.trim()) continue;

        const vector = await embedText(text);

        // Use a stable numeric-safe ID derived from the Appwrite doc ID
        points.push({
          id: doc.$id,
          vector,
          payload: {
            text,
            source: doc.source || 'Unknown',
            edition: doc.edition || 'unknown',
            category: doc.category || 'general',
            syncedFrom: 'appwrite',
            appwriteId: doc.$id,
          },
        });
      } catch (err) {
        errors.push({ id: doc.$id, error: err.message });
      }
    }

    // 5. Upsert all points into Qdrant in one batch
    if (points.length > 0) {
      await qdrant.upsert(QDRANT_COLLECTION, { wait: true, points });
    }

    const durationMs = Date.now() - startedAt;

    return Response.json({
      synced: points.length,
      totalFetched: allDocs.length,
      errors: errors.length > 0 ? errors : undefined,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Sync error:', err);
    return Response.json(
      { error: err.message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
