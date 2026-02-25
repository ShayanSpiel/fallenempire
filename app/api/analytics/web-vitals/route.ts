import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint for receiving web-vitals metrics from the client
 * This endpoint exists primarily to prevent 404 errors when the browser
 * or client libraries attempt to report web-vitals data
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body (optional - we just acknowledge it)
    const body = await request.json().catch(() => ({}));

    // Log in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Web Vitals] Received metrics:', {
        timestamp: new Date().toISOString(),
        metrics: body,
      });
    }

    // Return 200 OK - we don't need to process these in production
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Web Vitals] Error processing web-vitals:', error);
    return NextResponse.json(
      { error: 'Failed to process web-vitals' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Web Vitals endpoint' }, { status: 200 });
}
