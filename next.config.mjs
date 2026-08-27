/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [{ source: "/", destination: "/3.html", permanent: false }];
  },
  poweredByHeader: false,
};

export default nextConfig;
