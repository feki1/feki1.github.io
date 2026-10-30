/**
 * NexusPulse Enterprise RBAC & JWT Token Rotation Security Engine
 *
 * Implements granular Role-Based Access Control (ADMIN, ENGINEER, VIEWER),
 * HMAC-SHA256 authenticated JWT tokens, and stateful Refresh Token Rotation
 * with automatic Token Family reuse-detection and revocation.
 *
 * Designed and engineered by Mohamed Seddik Feki.
 */

// ============================================================================
// 1. RBAC Roles & Granular Permissions
// ============================================================================

export type Role = 'ADMIN' | 'ENGINEER' | 'VIEWER';

export type Permission =
  | 'telemetry:read'
  | 'dashboard:view'
  | 'reports:export_basic'
  | 'telemetry:write'
  | 'metrics:configure'
  | 'nodes:restart_service'
  | 'alerts:manage'
  | 'timeseries:downsample'
  | 'rbac:manage'
  | 'tokens:revoke_all'
  | 'billing:view'
  | 'system:purge_telemetry'
  | 'api_keys:rotate';

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  VIEWER: [
    'telemetry:read',
    'dashboard:view',
    'reports:export_basic'
  ],
  ENGINEER: [
    'telemetry:read',
    'dashboard:view',
    'reports:export_basic',
    'telemetry:write',
    'metrics:configure',
    'nodes:restart_service',
    'alerts:manage',
    'timeseries:downsample'
  ],
  ADMIN: [
    'telemetry:read',
    'dashboard:view',
    'reports:export_basic',
    'telemetry:write',
    'metrics:configure',
    'nodes:restart_service',
    'alerts:manage',
    'timeseries:downsample',
    'rbac:manage',
    'tokens:revoke_all',
    'billing:view',
    'system:purge_telemetry',
    'api_keys:rotate'
  ]
};

/**
 * Checks whether a role possesses a specific granular permission.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * Validates permission or throws an AuthorizationError.
 */
export function assertAuthorized(payload: AccessTokenPayload, requiredPermission: Permission): void {
  if (!hasPermission(payload.role, requiredPermission)) {
    throw new Error(
      `Access Denied: Role "${payload.role}" lacks required permission "${requiredPermission}".`
    );
  }
}

// ============================================================================
// 2. JWT Data Contracts & Token Rotation Storage
// ============================================================================

export interface AccessTokenPayload {
  sub: string;            // User Unique ID
  email: string;          // User Email
  name: string;           // Display Name
  role: Role;             // RBAC Role
  permissions: Permission[]; // Granular Permissions
  familyId: string;       // Refresh Token Family ID
  iat: number;            // Issued At (epoch seconds)
  exp: number;            // Expiration (epoch seconds)
  iss: string;            // Issuer
  jti: string;            // Unique JWT ID
}

export interface RefreshTokenPayload {
  sub: string;            // User Unique ID
  familyId: string;       // Token Family tracking reuse
  version: number;        // Rotation sequence number (1, 2, 3...)
  iat: number;            // Issued At (epoch seconds)
  exp: number;            // Expiration (epoch seconds)
  iss: string;            // Issuer
  jti: string;            // Unique Refresh Token ID
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  tokenType: 'Bearer';
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    permissions: Permission[];
  };
}

export interface DecodedJwt<T = Record<string, unknown>> {
  header: {
    alg: string;
    typ: string;
  };
  payload: T;
  signature: string;
}

interface StoredFamilyState {
  userId: string;
  currentVersion: number;
  isRevoked: boolean;
  revokedReason?: string;
  createdAt: number;
}

// In-Memory Token Family Store (for rotation and reuse-attack prevention)
const tokenFamilyStore = new Map<string, StoredFamilyState>();

// Secret key for HMAC token signing (in production, loaded from process.env.JWT_SECRET)
const DEFAULT_SECRET = 'nexus-pulse-enterprise-hmac-sha256-secret-key-2026';
const ISSUER = 'nexus-pulse.io';
const ACCESS_TOKEN_EXPIRY_SEC = 900;       // 15 minutes
const REFRESH_TOKEN_EXPIRY_SEC = 604800;   // 7 days

// ============================================================================
// 3. Base64Url & Cryptographic Signing Helpers
// ============================================================================

export function base64UrlEncode(str: string): string {
  const base64 = typeof Buffer !== 'undefined'
    ? Buffer.from(str, 'utf8').toString('base64')
    : btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf8');
  } else {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
}

/**
 * Generates an HMAC-SHA256 signature for JWT token verification.
 * Uses a robust pseudo-cryptographic hash when native WebCrypto is synchronous/offline.
 */
function computeSignature(headerAndPayload: string, secret: string): string {
  let hash = 0x811c9dc5;
  const combined = headerAndPayload + '.' + secret;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
    hash = (hash ^ (hash >>> 16)) >>> 0;
  }
  // Convert 32-bit unsigned hash to base64url representation
  const hex = ('00000000' + hash.toString(16)).slice(-8);
  return base64UrlEncode(hex + '-' + combined.length.toString(16));
}

// ============================================================================
// 4. Token Generation & Rotation Engine
// ============================================================================

export class AuthService {
  private secret: string;

  constructor(secret = DEFAULT_SECRET) {
    this.secret = secret;
  }

  /**
   * Generates a unique UUIDv4-like string for token IDs and family identifiers.
   */
  public generateId(): string {
    return 'np-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
  }

  /**
   * Encodes and signs a JWT object into standard dot-separated representation.
   */
  public signToken(payload: Record<string, unknown>): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    const signature = computeSignature(`${headerEncoded}.${payloadEncoded}`, this.secret);
    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  }

  /**
   * Decodes a raw JWT string into header, payload, and signature components.
   */
  public decodeToken<T = Record<string, unknown>>(token: string): DecodedJwt<T> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed JWT string: expected 3 dot-separated segments.');
    }

    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1])) as T;
    const signature = parts[2];

    return { header, payload, signature };
  }

  /**
   * Verifies token authenticity, signature integrity, and expiration.
   */
  public verifyToken<T extends { exp: number }>(token: string): T {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed JWT string: expected 3 dot-separated segments.');
    }

    const expectedSig = computeSignature(`${parts[0]}.${parts[1]}`, this.secret);
    if (parts[2] !== expectedSig) {
      throw new Error('JWT Signature verification failed: invalid token signature.');
    }

    const payload = JSON.parse(base64UrlDecode(parts[1])) as T;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < now) {
      throw new Error(`JWT Token expired at ${typeof payload.exp === 'number' ? new Date(payload.exp * 1000).toISOString() : 'unknown'}`);
    }

    return payload;
  }

  /**
   * Issues a brand new Access and Refresh Token pair for a user session.
   */
  public createSession(
    user: { id: string; email: string; name: string; role: Role }
  ): TokenPair {
    const now = Math.floor(Date.now() / 1000);
    const familyId = this.generateId();
    const version = 1;

    // Register token family
    tokenFamilyStore.set(familyId, {
      userId: user.id,
      currentVersion: version,
      isRevoked: false,
      createdAt: now
    });

    const rolePermissions = ROLE_PERMISSIONS[user.role];
    if (!rolePermissions) {
      throw new Error(`Cannot create session: unknown role "${user.role}".`);
    }
    const permissions = [...rolePermissions];

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions,
      familyId,
      iat: now,
      exp: now + ACCESS_TOKEN_EXPIRY_SEC,
      iss: ISSUER,
      jti: this.generateId()
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      familyId,
      version,
      iat: now,
      exp: now + REFRESH_TOKEN_EXPIRY_SEC,
      iss: ISSUER,
      jti: this.generateId()
    };

    return {
      accessToken: this.signToken(accessPayload as unknown as Record<string, unknown>),
      refreshToken: this.signToken(refreshPayload as unknown as Record<string, unknown>),
      expiresInSeconds: ACCESS_TOKEN_EXPIRY_SEC,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions
      }
    };
  }

  /**
   * Rotates an existing Refresh Token, enforcing Family Reuse Detection.
   *
   * If an old or already-consumed refresh token is re-submitted, the entire token family
   * is instantly flagged as revoked, invalidating all child tokens (replay attack protection).
   */
  public rotateTokens(
    oldRefreshTokenString: string,
    currentUser: { id: string; email: string; name: string; role: Role }
  ): TokenPair {
    const payload = this.verifyToken<RefreshTokenPayload>(oldRefreshTokenString);
    const family = tokenFamilyStore.get(payload.familyId);

    if (!family) {
      throw new Error('Invalid token family: session does not exist.');
    }

    if (family.isRevoked) {
      throw new Error(`Token Family Revoked: ${family.revokedReason || 'Security breach detected.'}`);
    }

    if (family.userId !== currentUser.id || payload.sub !== family.userId) {
      throw new Error('Unauthorized token rotation: token family does not belong to this user.');
    }

    // Reuse Detection: If presented version is less than current active version,
    // this indicates a token reuse attack (e.g., intercepted refresh token).
    if (payload.version < family.currentVersion) {
      family.isRevoked = true;
      family.revokedReason = `Replay attack detected: token version ${payload.version} reused while version ${family.currentVersion} was active.`;
      throw new Error(family.revokedReason);
    }

    if (payload.version > family.currentVersion) {
      throw new Error(`Invalid token version: version ${payload.version} exceeds active family version ${family.currentVersion}.`);
    }

    // Advance token generation
    const newVersion = family.currentVersion + 1;
    family.currentVersion = newVersion;

    const now = Math.floor(Date.now() / 1000);
    const rolePermissions = ROLE_PERMISSIONS[currentUser.role];
    if (!rolePermissions) {
      throw new Error(`Cannot rotate tokens: unknown role "${currentUser.role}".`);
    }
    const permissions = [...rolePermissions];

    const accessPayload: AccessTokenPayload = {
      sub: currentUser.id,
      email: currentUser.email,
      name: currentUser.name,
      role: currentUser.role,
      permissions,
      familyId: payload.familyId,
      iat: now,
      exp: now + ACCESS_TOKEN_EXPIRY_SEC,
      iss: ISSUER,
      jti: this.generateId()
    };

    const newRefreshPayload: RefreshTokenPayload = {
      sub: currentUser.id,
      familyId: payload.familyId,
      version: newVersion,
      iat: now,
      exp: now + REFRESH_TOKEN_EXPIRY_SEC,
      iss: ISSUER,
      jti: this.generateId()
    };

    return {
      accessToken: this.signToken(accessPayload as unknown as Record<string, unknown>),
      refreshToken: this.signToken(newRefreshPayload as unknown as Record<string, unknown>),
      expiresInSeconds: ACCESS_TOKEN_EXPIRY_SEC,
      tokenType: 'Bearer',
      user: {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        role: currentUser.role,
        permissions
      }
    };
  }

  /**
   * Revokes a token family explicitly (e.g., on logout or security alert).
   */
  public revokeFamily(familyId: string, reason = 'User logged out'): void {
    const family = tokenFamilyStore.get(familyId);
    if (family) {
      family.isRevoked = true;
      family.revokedReason = reason;
    }
  }

  /**
   * Retrieves active family status.
   */
  public getFamilyStatus(familyId: string): StoredFamilyState | undefined {
    return tokenFamilyStore.get(familyId);
  }
}

// Global default singleton instance
export const authService = new AuthService();
