/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [{ source: "/", destination: "/heishenhuawukong.html", permanent: false }];
  },
  poweredByHeader: false,
};

export default nextConfig;
