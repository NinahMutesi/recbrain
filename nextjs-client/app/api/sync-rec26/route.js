import { Client, Databases, Query } from 'node-appwrite';
import { QdrantClient } from '@qdrant/js-client-rest';
import axios from 'axios';

/**
 * GET /api/sync-rec26
 *
 * Pulls REAL, LIVE REC26 conference data from the NREP MODULES
 * project's HR database (REC_Program, REC_Sessions,
 * REC_SponsorCategories, REC_Sponsors) and syncs it into Qdrant
 * so the chatbot can answer questions using accurate, current
 * information.
 *
 * SAFETY: connects with a READ-ONLY API key (databases.read,
 * tables.read, rows.read only — no write scopes). Never touches
 * the production data, only reads it.
 *
 * PRIVACY: internalNotes, contactPerson, and contactEmail from
 * REC_Sponsors are deliberately excluded — these are private
 * staff-only fields and must never reach the chatbot or Qdrant.
 *
 * ACCURACY: every chunk is tagged with a freshness timestamp so
 * the chatbot's system prompt can hedge on anything stale.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'rec_conference';

// ── Source project (NREP MODULES / HR) — READ-ONLY key ──────────────────────
const SOURCE_ENDPOINT = process.env.REC26_APPWRITE_ENDPOINT;
const SOURCE_PROJECT_ID = process.env.REC26_APPWRITE_PROJECT_ID;
const SOURCE_API_KEY = process.env.REC26_APPWRITE_API_KEY;
const SOURCE_DATABASE_ID = process.env.REC26_HR_DATABASE_ID; // "HR" database

const TABLE_PROGRAM = process.env.REC26_TABLE_PROGRAM || '68e62391001de7d5c9be';
const TABLE_SESSIONS = process.env.REC26_TABLE_SESSIONS || '68e60fc1003b0bbb05d8';
const TABLE_SPONSOR_CATEGORIES = process.env.REC26_TABLE_SPONSOR_CATEGORIES || 'rec_sponsor_categories';
const TABLE_SPONSORS = process.env.REC26_TABLE_SPONSORS || 'rec_sponsors';

import crypto from 'crypto';

// Converts any string (like our source path) into a stable, deterministic UUID.
// Same input always produces the same UUID, so re-syncing updates the same
// point instead of creating duplicates.
function stringToUuid(input) {
  const hash = crypto.createHash('md5').update(input).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
}


async function embedText(text) {
  const res = await axios.post(`${OLLAMA_URL}/api/embeddings`, {
    model: 'nomic-embed-text',
    prompt: text,
  });
  return res.data.embedding;
}

async function fetchAll(databases, databaseId, tableId) {
  let all = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await databases.listDocuments(databaseId, tableId, [
      Query.limit(limit),
      Query.offset(offset),
    ]);
    all = all.concat(res.documents);
    if (res.documents.length < limit) break;
    offset += limit;
  }
  return all;
}

// ── Build human-readable chunks from each table ──────────────────────────────

function programToChunks(programs) {
  return programs.map((p) => ({
    source: `REC26/Program/${p.slug || p.$id}`,
    edition: 'REC26 2026',
    category: 'program',
    text: [
      `Program: ${p.title || 'Untitled'}.`,
      p.description ? `Description: ${p.description}` : '',
      p.daysCount ? `Duration: ${p.daysCount} day(s).` : '',
      p.venueHalls?.length ? `Venue halls: ${p.venueHalls.join(', ')}.` : '',
      p.status ? `Status: ${p.status}.` : '',
    ].filter(Boolean).join(' '),
  }));
}

function sessionsToChunks(sessions) {
  return sessions
    .filter((s) => s.status === 'PUBLISHED' || s.status === 'CONFIRMED' || !s.status)
    .map((s) => ({
      source: `REC26/Session/${s.$id}`,
      edition: 'REC26 2026',
      category: 'session',
      text: [
        `Session: ${s.title || 'Untitled session'}.`,
        s.theme ? `Theme: ${s.theme}.` : '',
        s.day ? `Day ${s.day}.` : '',
        s.startTime ? `Starts at ${new Date(s.startTime).toLocaleString('en-GB', { timeZone: 'Africa/Kampala' })}.` : '',
        s.toTime ? `Ends at ${new Date(s.toTime).toLocaleString('en-GB', { timeZone: 'Africa/Kampala' })}.` : '',
        s.venueHall ? `Venue: ${s.venueHall}.` : '',
        s.organizer ? `Organizer: ${s.organizer}.` : '',
        s.speakers ? `Speakers: ${s.speakers}.` : '',
        s.preamble ? `Details: ${s.preamble}` : '',
      ].filter(Boolean).join(' '),
    }));
}

function sponsorCategoriesToChunks(categories) {
  return categories
    .filter((c) => c.isActive !== false)
    .map((c) => ({
      source: `REC26/SponsorCategory/${c.slug || c.$id}`,
      edition: 'REC26 2026',
      category: 'sponsor_category',
      text: [
        `Sponsor category: ${c.name}.`,
        c.description ? `Description: ${c.description}` : '',
      ].filter(Boolean).join(' '),
    }));
}

function sponsorsToChunks(sponsors, categoriesById) {
  return sponsors
    .filter((s) => s.isActive !== false)
    .map((s) => {
      const categoryName = categoriesById[s.categoryId]?.name;
      return {
        source: `REC26/Sponsor/${s.$id}`,
        edition: 'REC26 2026',
        category: 'sponsor',
        // NOTE: deliberately excludes internalNotes, contactPerson, contactEmail
        text: [
          `Sponsor: ${s.name}.`,
          categoryName ? `Category: ${categoryName}.` : '',
          s.description ? `About: ${s.description}` : '',
          s.isFeatured ? 'This is a featured sponsor.' : '',
          s.siteUrl ? `Website: ${s.siteUrl}` : '',
        ].filter(Boolean).join(' '),
      };
    });
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.SYNC_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const syncedAtIso = new Date().toISOString();

  try {
    if (!SOURCE_ENDPOINT || !SOURCE_PROJECT_ID || !SOURCE_API_KEY || !SOURCE_DATABASE_ID) {
      return Response.json(
        { error: 'Missing REC26_* environment variables for the source (NREP MODULES) project.' },
        { status: 500 }
      );
    }

    const client = new Client()
      .setEndpoint(SOURCE_ENDPOINT)
      .setProject(SOURCE_PROJECT_ID)
      .setKey(SOURCE_API_KEY);
    const databases = new Databases(client);

    // 1. Fetch everything in parallel
    const [programs, sessions, categories, sponsors] = await Promise.all([
      fetchAll(databases, SOURCE_DATABASE_ID, TABLE_PROGRAM),
      fetchAll(databases, SOURCE_DATABASE_ID, TABLE_SESSIONS),
      fetchAll(databases, SOURCE_DATABASE_ID, TABLE_SPONSOR_CATEGORIES),
      fetchAll(databases, SOURCE_DATABASE_ID, TABLE_SPONSORS),
    ]);

    const categoriesById = {};
    categories.forEach((c) => { categoriesById[c.$id] = c; });

    // 2. Convert to text chunks
    const chunks = [
      ...programToChunks(programs),
      ...sessionsToChunks(sessions),
      ...sponsorCategoriesToChunks(categories),
      ...sponsorsToChunks(sponsors, categoriesById),
    ].filter((c) => c.text && c.text.trim().length > 5);

    if (chunks.length === 0) {
      return Response.json({
        synced: 0,
        message: 'No REC26 content found across Program, Sessions, SponsorCategories, Sponsors.',
        timestamp: syncedAtIso,
      });
    }

    // 3. Connect to Qdrant, ensure collection exists
    const qdrant = new QdrantClient({ url: QDRANT_URL });
    try {
      await qdrant.getCollection(QDRANT_COLLECTION);
    } catch {
      await qdrant.createCollection(QDRANT_COLLECTION, {
        vectors: { size: 768, distance: 'Cosine' },
      });
    }

    // 4. Embed + upsert
    const points = [];
    const errors = [];

    for (const chunk of chunks) {
      try {
        const vector = await embedText(chunk.text);
        points.push({
          id: stringToUuid(chunk.source),
          vector,
          payload: {
            text: chunk.text,
            source: chunk.source,
            edition: chunk.edition,
            category: chunk.category,
            syncedFrom: 'nrep_modules_hr',
            syncedAt: syncedAtIso,
          },
        });
      } catch (err) {
        errors.push({ source: chunk.source, error: err.message });
      }
    }

    if (points.length > 0) {
      await qdrant.upsert(QDRANT_COLLECTION, { wait: true, points });
    }

    const durationMs = Date.now() - startedAt;

    return Response.json({
      synced: points.length,
      breakdown: {
        programs: programs.length,
        sessions: sessions.length,
        sponsorCategories: categories.length,
        sponsors: sponsors.length,
      },
      errors: errors.length > 0 ? errors : undefined,
      durationMs,
      timestamp: syncedAtIso,
    });
  } catch (err) {
    console.error('REC26 sync error:', err);
    return Response.json(
      { error: err.message, timestamp: syncedAtIso },
      { status: 500 }
    );
  }
}
