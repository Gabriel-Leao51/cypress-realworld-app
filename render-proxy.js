import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { spawn } from "child_process";
import net from "net";

const PUBLIC_PORT = process.env.PORT || 10000; // Render injeta PORT; local usa 10000
const FRONTEND_PORT = 3000;
const BACKEND_PORT = 3001;

function waitForPort(port, host = "localhost", timeoutMs = 120000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = new net.Socket();
      socket.setTimeout(1500);

      socket
        .once("connect", () => {
          socket.destroy();
          resolve(true);
        })
        .once("timeout", () => {
          socket.destroy();
          retry();
        })
        .once("error", () => {
          socket.destroy();
          retry();
        })
        .connect(port, host);

      function retry() {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for ${host}:${port}`));
        } else {
          setTimeout(tryConnect, 500);
        }
      }
    };

    tryConnect();
  });
}

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: true, env });
    p.on("exit", (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

// Não deixe o PORT público “vazar” e quebrar o frontend
const childEnv = {
  ...process.env,
  PORT: String(FRONTEND_PORT), // frontend interno
  VITE_BACKEND_PORT: String(BACKEND_PORT), // backend interno
  PUBLIC_PORT: String(PUBLIC_PORT), // usado no CORS
};

// Inicia app sem “watch” (mais estável no Render)
// 1) seed  2) start (react + api)
(async () => {
  try {
    console.log("Seeding database...");
    await run("npx", ["yarn", "db:seed:dev"], childEnv);

    console.log("Starting app (yarn start)...");
    // Windows-safe: usa npx yarn
    spawn("npx", ["yarn", "start"], { stdio: "inherit", shell: true, env: childEnv });

    console.log("Waiting for internal ports...");
    await waitForPort(FRONTEND_PORT, "localhost", 180000);
    await waitForPort(BACKEND_PORT, "localhost", 180000);

    const app = express();

    // API
    app.use(
      "/api",
      createProxyMiddleware({
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
        proxyTimeout: 60000,
        timeout: 60000,
      })
    );

    // Frontend
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
      console.log(
        `Proxy listening on ${PUBLIC_PORT} (frontend:${FRONTEND_PORT}, backend:${BACKEND_PORT})`
      );
    });
  } catch (e) {
    console.error("Startup failed:", e);
    process.exit(1);
  }
})();
