/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@andresaya/edge-tts", "tencentcloud-sdk-nodejs-tts", "ws"],
  poweredByHeader: false,
};

export default nextConfig;
