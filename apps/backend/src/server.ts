import http from "node:http";

import mongoose from "mongoose";

import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { createSocketServer } from "./sockets/index.js";

const app = createApp();
const server = http.createServer(app);

const io = createSocketServer(server);
app.set("io", io);

async function start() {
  await connectDatabase();

  server.listen(env.PORT, "0.0.0.0", () => {
    process.stdout.write(
      `CampusX API listening on port ${env.PORT}\n`,
    );
  });
}

async function shutdown(signal: string) {
  process.stdout.write(
    `Received ${signal}; shutting down CampusX API\n`,
  );

  io.close();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  if (mongoose.connection.readyState !== 0) {
    await disconnectDatabase();
  }

  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void start().catch((error: unknown) => {
  process.stderr.write(
    `CampusX startup failed: ${error instanceof Error ? error.message : String(error)
    }\n`,
  );

  process.exit(1);
});
