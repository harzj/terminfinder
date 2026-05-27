import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const PREFIX = 'enc:v1:'

function getKey(): Buffer | null {
  const hex = process.env.CALENDAR_URL_ENCRYPTION_KEY ?? ''
  if (!hex || hex.length !== 64) return null
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypts a string using AES-256-GCM.
 * Returns the value unchanged if CALENDAR_URL_ENCRYPTION_KEY is not configured.
 * Format: enc:v1:<base64(12-byte-IV + 16-byte-AuthTag + ciphertext)>
 */
export function encryptUrl(value: string): string {
  if (!value) return value
  const key = getKey()
  if (!key) return value // no key configured → store plaintext
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64')
}

/**
 * Decrypts a string encrypted with encryptUrl.
 * Returns the value unchanged if it is not encrypted or decryption fails.
 */
export function decryptUrl(value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value
  const key = getKey()
  if (!key) return value
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), 'base64')
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const ct = buf.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(ct).toString('utf8') + decipher.final('utf8')
  } catch {
    return value
  }
}
