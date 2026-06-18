/**
 * GET /api/health
 *
 * Simple health check endpoint. Useful for:
 *   - Verifying the Next.js app is running after deployment
 *   - Uptime monitoring services (UptimeRobot, etc.)
 *   - Quick manual check: visit /api/health in a browser
 */
export async function GET() {
  return Response.json({
    status: 'ok',
    service: 'RECBrain Next.js Frontend',
    conference: 'REC Uganda (REC22-REC26)',
    timestamp: new Date().toISOString(),
  });
}
