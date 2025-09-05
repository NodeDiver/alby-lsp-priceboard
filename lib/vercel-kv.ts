import { kv } from '@vercel/kv'

// Vercel KV configuration
// Make sure to set these environment variables in your .env.local file
// KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN, KV_REST_API_READ_ONLY_TOKEN

export { kv }

// Helper function to check if KV is configured
export function isKVConfigured(): boolean {
  return !!(process.env.KV_URL && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}
