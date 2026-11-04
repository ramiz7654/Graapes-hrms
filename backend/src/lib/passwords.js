import crypto from 'node:crypto';

// No look-alike characters (0/O, 1/l/I) so a temporary password can be read out or typed without mistakes.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generateTemporaryPassword() {
  let body = '';
  for (let i = 0; i < 12; i += 1) body += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `Gr${body}@7`;
}

/** Returns an error message, or null when the new password is acceptable. */
export function validateNewPassword(password) {
  if (typeof password !== 'string') return 'Enter a new password.';
  if (password !== password.trim()) return 'Password cannot start or end with a space.';
  if (password.length < 10) return 'Password must be at least 10 characters.';
  if (password.length > 200) return 'Password is too long.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include an uppercase letter, a lowercase letter and a number.';
  }
  return null;
}
