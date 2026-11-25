import { UserRole } from '@/types/common';

export const ADMIN_SESSION_COOKIE = 'cct_admin_session';
export const CUSTOMER_SESSION_COOKIE = 'cct_customer_session';
export const CUSTOMER_DEMO_COOKIE = 'cct_customer_demo';
export const FIELD_SESSION_COOKIE = 'cct_field_session';
export const SESSION_MAX_AGE_SECONDS = 604800; // 7 days

export interface SessionTokenPayload {
  userId: string;
  role: UserRole;
  exp: number;
}

const MITSUI_ROLES: ReadonlySet<UserRole> = new Set([
  'DIEU_PHOI_VIEN',
  'QUAN_LY_QC',
  'QUAN_TRI_HE_THONG',
]);

const FIELD_ROLES: ReadonlySet<UserRole> = new Set([
  'NHA_CUNG_CAP',
  'NHAN_VIEN_SO_CHE',
  'NHAN_VIEN_KHO',
  'TAI_XE',
]);

export function isMitsuiRole(role: UserRole): boolean {
  return MITSUI_ROLES.has(role);
}

export function isFieldRole(role: UserRole): boolean {
  return FIELD_ROLES.has(role);
}

function getSecret(): string {
  return process.env.AUTH_SECRET || 'cct-dev-fallback-secret-change-in-env-32chars';
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSessionToken(
  userId: string,
  role: UserRole,
  ttlSeconds = SESSION_MAX_AGE_SECONDS
): Promise<string> {
  const payload: SessionTokenPayload = {
    userId,
    role,
    exp: Date.now() + ttlSeconds * 1000,
  };
  const enc = new TextEncoder();
  const bodyB64 = toBase64Url(enc.encode(JSON.stringify(payload)));
  const key = await importHmacKey();
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(bodyB64));
  const sigB64 = toBase64Url(new Uint8Array(sigBuf));
  return `${bodyB64}.${sigB64}`;
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionTokenPayload | null> {
  if (!token || !token.includes('.')) return null;
  const [bodyB64, sigB64] = token.split('.');
  if (!bodyB64 || !sigB64) return null;

  try {
    const enc = new TextEncoder();
    const key = await importHmacKey();
    const sigBytes = fromBase64Url(sigB64);
    const sigBuffer = new Uint8Array(sigBytes).buffer;
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuffer,
      enc.encode(bodyB64)
    );
    if (!valid) return null;

    const jsonStr = new TextDecoder().decode(fromBase64Url(bodyB64));
    const parsed = JSON.parse(jsonStr) as SessionTokenPayload;
    if (!parsed.userId || !parsed.role || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
