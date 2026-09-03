import { NextResponse } from 'next/server';
import { getClients, addClient, updateClient, deleteClient } from '@/lib/clientStore';
import { verifyToken } from '@/app/api/auth/login/route';

function authenticate(request) {
  const token = request.cookies.get('admin_token')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifyToken(token);
}

// GET — list all clients
export async function GET(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const clients = getClients();
  // Never expose API keys to the frontend
  const safeClients = clients.map(c => ({
    ...c,
    apiKey: c.apiKey ? `${c.apiKey.slice(0, 8)}...${c.apiKey.slice(-4)}` : '',
    hasApiKey: !!c.apiKey,
  }));

  return NextResponse.json({ clients: safeClients });
}

// POST — add new client
export async function POST(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { name, apiUrl, apiKey } = body;

    if (!name || !apiUrl || !apiKey) {
      return NextResponse.json({ message: 'Name, API URL, and API Key are required' }, { status: 400 });
    }

    const client = addClient({ name, apiUrl, apiKey, logo: body.logo });
    return NextResponse.json({ client }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// PUT — update a client
export async function PUT(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ message: 'Client ID is required' }, { status: 400 });
    }

    const client = updateClient(id, updates);
    if (!client) {
      return NextResponse.json({ message: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ client });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// DELETE — remove a client
export async function DELETE(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ message: 'Client ID is required' }, { status: 400 });
    }

    const deleted = deleteClient(id);
    if (!deleted) {
      return NextResponse.json({ message: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
