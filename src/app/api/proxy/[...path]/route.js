import { NextResponse } from 'next/server';
import { getClient } from '@/lib/clientStore';
import { verifyToken } from '@/app/api/auth/login/route';

function authenticate(request) {
  const token = request.cookies.get('admin_token')?.value ||
                request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Proxy route: GET /api/proxy/[clientId]/[...path]
 * Forwards to: [client.apiUrl]/api/public-data/[...path]
 *
 * Example: /api/proxy/client_123/summary → https://bennecafe.onrender.com/api/public-data/summary
 */
export async function GET(request, { params }) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const resolvedParams = await params;
    const pathParts = resolvedParams.path || [];
    
    if (pathParts.length < 2) {
      return NextResponse.json({ message: 'Usage: /api/proxy/[clientId]/[endpoint]' }, { status: 400 });
    }

    const clientId = pathParts[0];
    const endpoint = '/' + pathParts.slice(1).join('/');

    const client = getClient(clientId);
    if (!client) {
      return NextResponse.json({ message: 'Client not found' }, { status: 404 });
    }

    // Build target URL with query params
    const url = new URL(`${client.apiUrl}/api/public-data${endpoint}`);
    const { searchParams } = new URL(request.url);
    searchParams.forEach((val, key) => url.searchParams.set(key, val));

    const res = await fetch(url.toString(), {
      headers: {
        'X-API-KEY': client.apiKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { message: `Client API error: ${res.status}`, details: errText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[Proxy]', err.message);
    return NextResponse.json(
      { message: 'Failed to fetch from client', error: err.message },
      { status: 502 }
    );
  }
}
