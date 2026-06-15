import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { Client, Databases, ID, Query } from 'node-appwrite';
import { QdrantClient } from '@qdrant/js-client-rest';
import axios from 'axios';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET','POST'] }
});
app.use(cors());
app.use(express.json());

const appwriteClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(appwriteClient);
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL });

const SYSTEM_PROMPT = `You are REC Assistant — the official AI chatbot for Uganda's
Annual Renewable Energy Conference and EXPO (REC), organised by the Ministry of
Energy and Mineral Development (MEMD) and the National Renewable Energy Platform (NREP).
You have knowledge of ALL REC editions from REC22 (2022) through REC26 (2026).
You ONLY answer questions using the REC conference context documents provided.
You NEVER use outside knowledge.
You can help with: history and background of REC, conference themes, dates and venues,
speakers and session topics, registration, exhibition, sponsorship, NREP and MEMD info,
and upcoming REC26 (2026) information.
If a question is not about REC conferences respond EXACTLY:
"I can only answer questions about the REC (Renewable Energy Conference) Uganda.
For other enquiries please visit nrep.ug or email info@nrep.ug"
Always cite which REC edition your answer refers to. Be helpful and concise.`;

const OFF_TOPIC = [
  'football','soccer','politics','election','bitcoin','crypto',
  'stock market','celebrity','gossip','fashion','movie','netflix',
  'music','sports score','weather','hospital','doctor',
  'immigration','visa','salary','oil drilling','petroleum'
];

function isOffTopic(q) {
  return OFF_TOPIC.some(kw => q.toLowerCase().includes(kw));
}

async function embedText(text) {
  const res = await axios.post(`${process.env.OLLAMA_URL}/api/embeddings`, {
    model: 'nomic-embed-text', prompt: text
  });
  return res.data.embedding;
}

async function searchQdrant(question, limit = 5) {
  try {
    const vector = await embedText(question);
    const results = await qdrant.search(process.env.QDRANT_COLLECTION, {
      vector, limit, with_payload: true, score_threshold: 0.45
    });
    return results.map(r => ({
      text: r.payload.text,
      source: r.payload.source
        .replace('REC/Background/', 'NREP › ')
        .replace('REC/Features/', 'REC › ')
        .replace('REC22/', 'REC22 › ')
        .replace('REC23/', 'REC23 › ')
        .replace('REC24/', 'REC24 › ')
        .replace('REC25/', 'REC25 › ')
        .replace('REC26/', 'REC26 › ')
        .replace('REC/How-To-Update/', 'Guide › ')
        .replace(/-/g, ' '),
      edition: r.payload.edition,
      score: r.score
    }));
  } catch (err) {
    console.error('Qdrant error:', err.message);
    return [];
  }
}

async function saveMessage(sessionId, role, content) {
  try {
    await databases.createDocument(
      process.env.APPWRITE_DATABASE_ID,
      process.env.APPWRITE_COLLECTION_ID,
      ID.unique(),
      { sessionId, role, content, createdAt: new Date().toISOString() }
    );
  } catch (err) { console.error('Appwrite save error:', err.message); }
}

async function getHistory(sessionId, limit = 8) {
  try {
    const res = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID,
      process.env.APPWRITE_COLLECTION_ID,
      [Query.equal('sessionId', sessionId),
       Query.orderDesc('createdAt'),
       Query.limit(limit)]
    );
    return res.documents.reverse();
  } catch (err) { return []; }
}

async function streamOllama(prompt, socket) {
  const res = await axios.post(
    `${process.env.OLLAMA_URL}/api/generate`,
    { model: process.env.OLLAMA_MODEL, prompt, stream: true },
    { responseType: 'stream' }
  );
  let full = '';
  return new Promise((resolve, reject) => {
    res.data.on('data', chunk => {
      try {
        chunk.toString().split('\n').filter(Boolean).forEach(line => {
          const data = JSON.parse(line);
          if (data.response) {
            full += data.response;
            socket.emit('chat:response', {
              type: 'token', token: data.response
            });
          }
          if (data.done) {
            socket.emit('chat:response', { type: 'done' });
            resolve(full);
          }
        });
      } catch (_) {}
    });
    res.data.on('error', reject);
  });
}

async function bootstrapAppwrite() {
  try {
    await databases.create(
      process.env.APPWRITE_DATABASE_ID, 'RECBrain DB'
    );
    console.log('✓ Appwrite DB created');
  } catch (_) { console.log('→ Appwrite DB exists'); }

  try {
    await databases.createCollection(
      process.env.APPWRITE_DATABASE_ID,
      process.env.APPWRITE_COLLECTION_ID,
      'Chat Messages'
    );
    await Promise.all([
      databases.createStringAttribute(
        process.env.APPWRITE_DATABASE_ID,
        process.env.APPWRITE_COLLECTION_ID,
        'sessionId', 255, true),
      databases.createStringAttribute(
        process.env.APPWRITE_DATABASE_ID,
        process.env.APPWRITE_COLLECTION_ID,
        'role', 20, true),
      databases.createStringAttribute(
        process.env.APPWRITE_DATABASE_ID,
        process.env.APPWRITE_COLLECTION_ID,
        'content', 5000, true),
      databases.createStringAttribute(
        process.env.APPWRITE_DATABASE_ID,
        process.env.APPWRITE_COLLECTION_ID,
        'createdAt', 50, true),
    ]);
    console.log('✓ Appwrite collection created');
  } catch (_) { console.log('→ Appwrite collection exists'); }
}

io.on('connection', socket => {
  console.log('🟢 Connected:', socket.id);

  socket.on('chat:message', async ({ question, sessionId }) => {
    if (!question?.trim() || !sessionId)
      return socket.emit('chat:response',
        { type: 'error', message: 'Question and sessionId required.' });

    if (question.length > 500)
      return socket.emit('chat:response',
        { type: 'error', message: 'Please keep question under 500 characters.' });

    if (isOffTopic(question)) {
      socket.emit('chat:response', { type: 'token', token:
        'I can only answer questions about the REC (Renewable Energy Conference) Uganda. ' +
        'For other enquiries please visit nrep.ug or email info@nrep.ug' });
      return socket.emit('chat:response', { type: 'done' });
    }

    await saveMessage(sessionId, 'user', question);
    socket.emit('chat:response', { type: 'thinking' });

    try {
      const docs = await searchQdrant(question);

      if (docs.length === 0) {
        const msg = 'I could not find specific information about this in the REC ' +
          'conference records. Please visit nrep.ug or contact info@nrep.ug';
        socket.emit('chat:response', { type: 'token', token: msg });
        socket.emit('chat:response', { type: 'done' });
        await saveMessage(sessionId, 'assistant', msg);
        return;
      }

      const context = docs
        .map((d, i) => `[${i+1}. ${d.source} — ${d.edition}]\n${d.text}`)
        .join('\n\n');

      const history = await getHistory(sessionId);
      const historyText = history
        .map(m => `${m.role === 'user' ? 'User' : 'REC Assistant'}: ${m.content}`)
        .join('\n');

      const prompt = `${SYSTEM_PROMPT}

--- CONVERSATION HISTORY ---
${historyText || 'New conversation.'}

--- REC KNOWLEDGE BASE ---
${context}

--- USER QUESTION ---
${question}

--- REC ASSISTANT RESPONSE ---`;

      const fullResponse = await streamOllama(prompt, socket);
      const sources = [...new Set(docs.map(d => d.source).filter(Boolean))];
      if (sources.length > 0)
        socket.emit('chat:response', { type: 'sources', sources });
      await saveMessage(sessionId, 'assistant', fullResponse);

    } catch (err) {
      console.error('Error:', err.message);
      socket.emit('chat:response',
        { type: 'error', message: 'Something went wrong. Please try again.' });
    }
  });

  socket.on('chat:history', async ({ sessionId }) => {
    const history = await getHistory(sessionId, 20);
    socket.emit('chat:history:response', { history });
  });

  socket.on('disconnect', () => console.log('🔴 Disconnected:', socket.id));
});

app.get('/health', (_, res) => res.json({
  status: 'ok',
  conference: 'REC Uganda REC22-REC26',
  model: process.env.OLLAMA_MODEL
}));

bootstrapAppwrite().then(() => {
  httpServer.listen(process.env.PORT || 3001, () => {
    console.log(`\n RECBrain server running on port ${process.env.PORT || 3001}`);
    console.log(`   Covers: REC22 (2022) to REC26 (2026)\n`);
  });
});