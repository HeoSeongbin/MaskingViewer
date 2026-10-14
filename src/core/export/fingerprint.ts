export async function fingerprint(data: Uint8Array) {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new Uint8Array(data)),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}
