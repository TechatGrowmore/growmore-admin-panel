// Cloudflare R2 storage (S3-compatible). Files stay private and are served through /api/files/*.
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET = process.env.R2_BUCKET;

let client;
function getClient() {
  if (!client) {
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !BUCKET) {
      throw new Error('R2 storage is not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)');
    }
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

const TYPES = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf',
};

// Detect the real file type from its first bytes (never trust the client's filename)
function sniffType(buf) {
  if (buf.length > 4 && buf.slice(0, 4).toString() === '%PDF') return 'pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf[0] === 0x89 && buf.slice(1, 4).toString() === 'PNG') return 'png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  if (buf.slice(0, 3).toString() === 'GIF') return 'gif';
  return 'jpg'; // phone photos (HEIC etc.) are rare here; browsers send jpeg/png
}

// Uploads a buffer; returns { key, secure_url } where secure_url is the app-relative URL stored in the DB
async function uploadFile(buffer, folder, name) {
  const ext = sniffType(buffer);
  const key = `${folder}/${name}-${Date.now()}.${ext}`;
  await getClient().send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: buffer, ContentType: TYPES[ext],
  }));
  return { key, secure_url: `/api/files/${key}` };
}

async function getFile(key) {
  return getClient().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { uploadFile, getFile, TYPES };
