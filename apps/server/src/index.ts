import { createServer } from "node:http";
import { createApp } from "./app.js";
import { loadServerConfig } from "./config.js";

const config = loadServerConfig();
const server = createServer(createApp(config));

server.listen(config.port, () => {
  console.log(`Community Pulse API listening on http://localhost:${config.port}`);
});
