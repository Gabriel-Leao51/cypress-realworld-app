import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { spawn } from "child_process";

const PUBLIC_PORT = process.env.PORT || 10000; // proxy público (10000 local / PORT no Render)
const FRONTEND_PORT = 3000;
const BACKEND_PORT = 3001;

// IMPORTANTÍSSIMO: não deixe PORT público contaminar o frontend
const childEnv = {
  ...process.env,
  PORT: String(FRONTEND_PORT),
  VITE_BACKEND_PORT: String(BACKEND_PORT),
  PUBLIC_PORT: String(PUBLIC_PORT),
};

// Windows-safe: chama yarn via npx (evita "'yarn' is not recognized")
spawn("npx", ["yarn", "dev"], { stdio: "inherit", shell: true, env: childEnv });

const app = express();

app.use(
  "/api",
  createProxyMiddleware({
    target: `http://localhost:${BACKEND_PORT}`,
    changeOrigin: true,
    proxyTimeout: 60000,
    timeout: 60000,
  })
);

app.use(
  "/",
  createProxyMiddleware({
    target: `http://localhost:${FRONTEND_PORT}`,
    changeOrigin: true,
    ws: true,
    proxyTimeout: 60000,
    timeout: 60000,
  })
);

app.listen(PUBLIC_PORT, "0.0.0.0", () => {
  console.log(`Proxy listening on ${PUBLIC_PORT}`);
});
