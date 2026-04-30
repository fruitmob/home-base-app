import { env } from "process";

/**
 * Utility file for interacting with Cloudflare Stream.
 * Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to be set.
 */

const getAccountId = () => env.CLOUDFLARE_ACCOUNT_ID;
const getApiToken = () => env.CLOUDFLARE_API_TOKEN;
const getCustomerCode = () => env.CLOUDFLARE_STREAM_CUSTOMER_CODE;
const shouldUseMockStream = () =>
  env.NODE_ENV === "development" || env.CLOUDFLARE_STREAM_MOCK === "true";

export type CloudflareUploadMeta = {
  name: string;
  meta: Record<string, string>;
  creator?: string;
  requireSignedURLs?: boolean;
};

/**
 * Generates a one-time Direct Upload URL for Cloudflare Stream.
 * 
 * @param metadata - Metadata attached to the video in Cloudflare.
 * @returns {Promise<{ uploadUrl: string, uid: string }>}
 */
export async function requestDirectUploadUrl(metadata: CloudflareUploadMeta) {
  const accountId = getAccountId();
  const token = getApiToken();

  if (!accountId || !token) {
    if (shouldUseMockStream()) {
      console.warn("MOCKING CLOUDFLARE DIRECT UPLOAD URL. Missing credentials.");
      return {
        uploadUrl: "mock://cloudflare.stream/upload",
        uid: `mock-video-${Date.now()}`
      };
    }
    throw new Error("Missing Cloudflare Stream credentials");
  }

  // See: https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads
  const body = {
    maxDurationSeconds: 600, // Tech recordings shouldn't exceed 10m limit
    creator: metadata.creator,
    requireSignedURLs: metadata.requireSignedURLs ?? false,
    allowedOrigins: ["*"], 
    meta: {
      ...metadata.meta,
      name: metadata.name
    },
    // Triggers Voice->Text Whisper Models
    // NOTE: Cloudflare enables captions typically per video settings or via webhooks
    // We pass general metadata here to map it back to our platform.
  };

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cloudflare Direct Upload Request Failed: ${err}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`Cloudflare Direct Upload Request Failed: ${JSON.stringify(result.errors)}`);
  }

  return {
    uploadUrl: result.result.uploadURL,
    uid: result.result.uid
  };
}

/**
 * Given a cloudflare video id, fetches signed playback tokens.
 * Overkill if `requireSignedURLs` is false.
 */
export async function getPlaybackTokens(videoId: string) {
  const accountId = getAccountId();
  const token = getApiToken();

  if (!accountId || !token) {
    if (shouldUseMockStream()) {
      return { token: "mock-token" };
    }

    throw new Error("Missing Cloudflare Stream credentials");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      // You can limit constraints here e.g. expirations, domains:
      body: JSON.stringify({
        exp: Math.floor(Date.now() / 1000) + 3600 * 24, // 24 hours
        downloadable: false,
      })
    }
  );

  if (!response.ok) {
     throw new Error(`Failed to generate signed token for ${videoId}`);
  }

  const result = await response.json();
  return {
    token: result.result.token
  };
}

export function getStreamIframeUrl(identifier: string) {
  const customerCode = getCustomerCode();

  if (!customerCode) {
    return null;
  }

  return `https://customer-${customerCode}.cloudflarestream.com/${encodeURIComponent(identifier)}/iframe`;
}
