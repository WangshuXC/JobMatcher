import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright 只在服务端运行，不应被打包到客户端
  serverExternalPackages: ["playwright"],

  // API 路由超时设置
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
