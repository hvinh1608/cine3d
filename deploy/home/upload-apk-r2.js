/**
 * Upload mobile/cine3d.apk to Cloudflare R2 (S3-compatible).
 *
 * Setup (one-time, Cloudflare dashboard — Free tier, no charge inside limits):
 * 1. R2 → Create bucket e.g. cine3d-apk
 * 2. Settings → Public access → Allow Access (r2.dev URL) OR custom domain cdn.cine3d.id.vn
 * 3. Manage R2 API Tokens → Create API token (Object Read & Write)
 * 4. Put values in .env.home (do not commit):
 *      R2_ACCOUNT_ID=...
 *      R2_ACCESS_KEY_ID=...
 *      R2_SECRET_ACCESS_KEY=...
 *      R2_BUCKET=cine3d-apk
 *      R2_PUBLIC_BASE=https://pub-xxxx.r2.dev   (or https://cdn.cine3d.id.vn)
 *
 * Usage:
 *   node deploy/home/upload-apk-r2.js
 *
 * Then set in .env.home / rebuild frontend:
 *   NEXT_PUBLIC_ANDROID_APK_URL=$R2_PUBLIC_BASE/cine3d.apk
 */
const fs = require('fs');
const path = require('path');
const { createHash, createHmac } = require('crypto');

function loadEnvHome() {
  const envPath = path.join(__dirname, '..', '..', '.env.home');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function hmac(key, data, encoding) {
  return createHmac('sha256', key).update(data, typeof data === 'string' ? 'utf8' : undefined).digest(encoding);
}

function hashHex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function amzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

async function putObject({ accountId, accessKeyId, secretAccessKey, bucket, key, body, contentType }) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}/${bucket}/${key}`;
  const now = new Date();
  const amz = amzDate(now);
  const dateStamp = amz.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const payloadHash = hashHex(body);
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amz}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    `/${bucket}/${key}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amz, credentialScope, hashHex(canonicalRequest)].join('\n');
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign, 'hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      Host: host,
      'X-Amz-Content-Sha256': payloadHash,
      'X-Amz-Date': amz,
      Authorization: authorization,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 upload failed ${res.status}: ${text.slice(0, 500)}`);
  }
}

async function main() {
  loadEnvHome();
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim() || 'cine3d-apk';
  const publicBase = process.env.R2_PUBLIC_BASE?.trim()?.replace(/\/$/, '');
  const key = process.env.R2_OBJECT_KEY?.trim() || 'cine3d.apk';
  const apkPath = path.join(__dirname, '..', '..', 'mobile', 'cine3d.apk');

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in .env.home');
    console.error('See comments at top of deploy/home/upload-apk-r2.js');
    process.exit(1);
  }
  if (!fs.existsSync(apkPath)) {
    console.error(`APK not found: ${apkPath}`);
    process.exit(1);
  }

  const body = fs.readFileSync(apkPath);
  console.log(`Uploading ${apkPath} (${(body.length / 1e6).toFixed(1)} MB) → r2://${bucket}/${key}`);
  await putObject({
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    key,
    body,
    contentType: 'application/vnd.android.package-archive',
  });

  const publicUrl = publicBase ? `${publicBase}/${key}` : `(set R2_PUBLIC_BASE for public URL)`;
  console.log('Upload OK');
  console.log(`Public URL: ${publicUrl}`);
  console.log('Next: set NEXT_PUBLIC_ANDROID_APK_URL to that URL, then rebuild frontend.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
