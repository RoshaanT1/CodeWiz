import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // web-tree-sitter loads its own files at runtime; bundling would break that.
  serverExternalPackages: ["web-tree-sitter"],
  // Ship the .wasm files with the deployed function. They are read with fs at
  // runtime, so output file tracing can't see them on its own.
  outputFileTracingIncludes: {
    "/api/repos/functions": [
      "./node_modules/web-tree-sitter/tree-sitter.wasm",
      "./node_modules/tree-sitter-wasms/out/tree-sitter-python.wasm",
      "./node_modules/tree-sitter-wasms/out/tree-sitter-javascript.wasm",
      "./node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm",
      "./node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm",
      "./node_modules/web-tree-sitter/package.json",
      "./node_modules/tree-sitter-wasms/package.json",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://api.github.com https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.groq.com https://openrouter.ai; img-src 'self' data: https:; font-src 'self' data:; frame-ancestors 'none';",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/mfa/enrol",
        destination: "/2fa/enrol",
        permanent: false,
      },
      {
        source: "/mfa/verify",
        destination: "/2fa/verify",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
