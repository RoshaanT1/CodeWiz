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
