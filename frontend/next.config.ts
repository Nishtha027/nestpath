import type { NextConfig } from "next";

// On Vercel, fail the build loudly rather than ship a site that is quietly
// broken: with no API URL, lib/api.ts falls back to localhost; with an
// http:// one, browsers block every request from the https page as mixed
// content, and the WebSocket would be ws:// instead of wss://.
if (process.env.VERCEL) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Set it in the Vercel project's environment variables " +
        "to the deployed backend's https:// URL."
    );
  }
  if (!apiUrl.startsWith("https://")) {
    throw new Error(
      `NEXT_PUBLIC_API_URL must be an https:// URL on a deployed site (got "${apiUrl}"): ` +
        "browsers block insecure requests and ws:// WebSockets from an https page."
    );
  }
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
