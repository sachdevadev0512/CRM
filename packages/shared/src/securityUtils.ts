/**
 * Centralized security utility functions for Middha Ventures Investment CRM.
 * Protects against XSS, validates URLs, and ensures safe links.
 */

const SAFE_PROTOCOLS = ['http:', 'https:'];

/**
 * Validates and sanitizes raw URL strings to prevent stored XSS (like javascript: URIs).
 * Returns a valid http/https URL, or '#' if invalid or dangerous.
 */
export function safeHref(raw?: string | null): string {
  if (!raw) return '#';
  const trimmed = raw.trim();
  
  // Prevent trivial dangerous protocol executions
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return '#';
  }

  try {
    // If it has a protocol, verify it is in SAFE_PROTOCOLS
    if (/^[a-z]+:/i.test(trimmed)) {
      const parsed = new URL(trimmed);
      if (SAFE_PROTOCOLS.includes(parsed.protocol)) {
        return parsed.toString();
      }
      return '#';
    } else {
      // No protocol, prepend https://
      const parsed = new URL(`https://${trimmed}`);
      return parsed.toString();
    }
  } catch {
    return '#';
  }
}

/**
 * Checks if a string is a valid HTTP/HTTPS URL.
 */
export function isValidHttpUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  const trimmed = url.trim();
  try {
    const withProto = trimmed.startsWith('http://') || trimmed.startsWith('https://') 
      ? trimmed 
      : `https://${trimmed}`;
    const parsed = new URL(withProto);
    return SAFE_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Strictly validates LinkedIn profiles to ensure they are legitimate linkedIn URLs.
 * Matches: https://linkedin.com/in/..., http://www.linkedin.com/in/..., the 1-letter
 * mobile subdomain (https://m.linkedin.com/in/...), and LinkedIn's own share-link
 * domain (https://lnkd.in/...) -- all of these show up in real copy-pasted LinkedIn
 * links, so rejecting them was a false negative, not a security boundary.
 */
export function validateLinkedInUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  const trimmed = url.trim();
  const withProto = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`;
  const pattern = /^https?:\/\/(?:([a-z]{1,3}\.)?linkedin\.com\/[a-z0-9_-]|lnkd\.in\/[a-z0-9_-]+)/i;
  return pattern.test(withProto);
}

/**
 * Cleans and standardizes a URL.
 * If the input is empty, "NA", "N/A", or whitespace, returns null.
 * Otherwise, prepends "https://" if a protocol is missing, and returns the cleaned URL.
 */
export function cleanUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.toLowerCase() === 'na' || trimmed.toLowerCase() === 'n/a') {
    return null;
  }
  
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  return `https://${trimmed}`;
}

/**
 * Sanitizes and cleans user input strings to prevent HTML injection and keep data clean.
 */
export function sanitizeInput(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
