import forge from 'node-forge';

export interface KeyPairResult {
  privateKeyPem: string;
  publicKeyPem: string;
  publicKeyFingerprint: string;
  snowflakeAlterStatement: string;
}

/**
 * Generate an RSA key pair for Snowflake key-pair authentication.
 * Snowflake requires 2048-bit minimum RSA keys.
 */
export function generateKeyPair(username: string): KeyPairResult {
  const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });

  const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
  const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey);

  // Extract the base64 body (strip headers) for Snowflake
  const publicKeyBody = publicKeyPem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\r?\n/g, '')
    .trim();

  // Calculate SHA-256 fingerprint (Snowflake uses this for verification)
  const publicKeyDer = forge.asn1.toDer(forge.pki.publicKeyToAsn1(keypair.publicKey)).getBytes();
  const sha256 = forge.md.sha256.create();
  sha256.update(publicKeyDer);
  const fingerprint = `SHA256:${forge.util.encode64(sha256.digest().getBytes())}`;

  const snowflakeAlterStatement = `ALTER USER ${username} SET RSA_PUBLIC_KEY='${publicKeyBody}';`;

  return {
    privateKeyPem,
    publicKeyPem,
    publicKeyFingerprint: fingerprint,
    snowflakeAlterStatement,
  };
}

/**
 * Validate that a private key PEM is correctly formatted
 */
export function validatePrivateKey(pem: string): { valid: boolean; error?: string } {
  try {
    const trimmed = pem.trim();
    if (!trimmed.includes('-----BEGIN') || !trimmed.includes('PRIVATE KEY-----')) {
      return { valid: false, error: 'Key must be in PEM format (BEGIN/END PRIVATE KEY headers)' };
    }

    // Try parsing with node-forge
    if (trimmed.includes('RSA PRIVATE KEY')) {
      forge.pki.privateKeyFromPem(trimmed);
    } else if (trimmed.includes('ENCRYPTED PRIVATE KEY')) {
      return { valid: false, error: 'Encrypted keys are not supported. Use an unencrypted PEM key.' };
    } else {
      forge.pki.privateKeyFromPem(trimmed);
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Invalid private key: ${(err as Error).message}` };
  }
}
