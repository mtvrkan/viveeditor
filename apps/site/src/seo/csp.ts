import { inlineScriptHashes } from './inlineScripts'

export const FRAME_HOSTS = ['www.youtube-nocookie.com', 'player.vimeo.com', 'open.spotify.com']

export const CSP_DIRECTIVES = [
  "default-src 'self'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  `frame-src ${FRAME_HOSTS.map((host) => `https://${host}`).join(' ')}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
]

export function cspConfig() {
  return {
    directives: CSP_DIRECTIVES,
    scriptDirective: { resources: ["'self'"], hashes: inlineScriptHashes() },
    styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
  }
}
