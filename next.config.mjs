/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { webpack }) => {
    // node: 스킴 접두어 제거 → fallback 적용 (클라이언트 번들에서 Node 내장 무시)
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, '');
      }),
    );
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false, https: false, http: false, stream: false, zlib: false, path: false, os: false, crypto: false, util: false, url: false,
    };
    return config;
  },
};
export default nextConfig;
