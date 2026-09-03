import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

// Ensure data directory and file exist
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CLIENTS_FILE)) {
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify([], null, 2));
  }
}

export function getClients() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(CLIENTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getClient(id) {
  const clients = getClients();
  return clients.find(c => c.id === id) || null;
}

export function addClient(client) {
  const clients = getClients();
  const newClient = {
    id: `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: client.name,
    apiUrl: client.apiUrl.replace(/\/$/, ''), // remove trailing slash
    apiKey: client.apiKey,
    logo: client.logo || null,
    createdAt: new Date().toISOString(),
    isActive: true,
  };
  clients.push(newClient);
  saveClients(clients);
  return newClient;
}

export function updateClient(id, updates) {
  const clients = getClients();
  const index = clients.findIndex(c => c.id === id);
  if (index === -1) return null;
  
  clients[index] = { ...clients[index], ...updates, id }; // prevent id overwrite
  if (updates.apiUrl) {
    clients[index].apiUrl = updates.apiUrl.replace(/\/$/, '');
  }
  saveClients(clients);
  return clients[index];
}

export function deleteClient(id) {
  let clients = getClients();
  const before = clients.length;
  clients = clients.filter(c => c.id !== id);
  saveClients(clients);
  return clients.length < before;
}

function saveClients(clients) {
  ensureDataFile();
  fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2));
}
