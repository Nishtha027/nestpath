export type JwtPayload = {
  sub: string;
  family_id: string;
  iat: number;
  exp: number;
};

/** Decodes a JWT's payload without verifying its signature -- fine here
 * since the server re-validates the token on every request; this is only
 * used client-side to read non-sensitive claims (caregiver/family id). */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split(".");
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
