/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@andresaya/edge-tts", "tencentcloud-sdk-nodejs-tts", "ws"],
  async redirects() {
    return [{ source: "/", destination: "/heishenhuawukong.html", permanent: false }];
  },
  poweredByHeader: false,
};

export default nextConfig;
