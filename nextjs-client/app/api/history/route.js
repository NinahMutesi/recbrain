import { Client, Databases, Query } from 'node-appwrite';

/**
 * GET /api/history?sessionId=xxxx
 *
 * This route lets the browser fetch chat history WITHOUT ever
 * talking to Appwrite directly. The browser only ever calls this
 * Next.js route; the Appwrite Project ID and API Key stay on the
 * server and are never sent to the client.
 *
 * (Note: in the current architecture, history is also sent over
 * Socket.IO directly from server.js. This route is an alternative/
 * additional way to fetch history via plain HTTP, useful for
 * server-side rendering a page with prior messages already loaded.)
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return Response.json({ error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);

    const response = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID || 'recbrain_db',
      process.env.APPWRITE_COLLECTION_ID || 'chat_messages',
      [
        Query.equal('sessionId', sessionId),
        Query.orderDesc('createdAt'),
        Query.limit(20),
      ]
    );

    const history = response.documents.reverse().map((doc) => ({
      id: doc.$id,
      role: doc.role,
      content: doc.content,
      createdAt: doc.createdAt,
    }));

    return Response.json({ history });
  } catch (err) {
    console.error('History fetch error:', err);
    return Response.json({ history: [], error: err.message }, { status: 500 });
  }
}
