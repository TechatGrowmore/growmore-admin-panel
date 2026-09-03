/**
 * Fetch data from a client's public data API.
 * Used server-side in API routes and Server Components.
 */
export async function fetchClientData(apiUrl, apiKey, endpoint, params = {}) {
  const url = new URL(`${apiUrl}/api/public-data${endpoint}`);
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.set(key, val);
    }
  });

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // always fetch fresh data
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Client API error ${res.status}: ${errBody}`);
    }

    return await res.json();
  } catch (err) {
    console.error(`[fetchClientData] ${apiUrl}${endpoint} failed:`, err.message);
    throw err;
  }
}

/**
 * Test connection to a client API
 */
export async function testClientConnection(apiUrl, apiKey) {
  try {
    const data = await fetchClientData(apiUrl, apiKey, '/health');
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
