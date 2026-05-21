/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  distDir: isDev ? '../../../../Downloads/gizops-next' : '.next-local',
};

export default nextConfig;
