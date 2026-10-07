import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);


// server/proxy-paths.ts
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
var SERVER_ROOT = dirname(fileURLToPath(import.meta.url));
function resolveProxy(relative) {
  const source = join(SERVER_ROOT, `${relative}.ts`);
  return existsSync(source) ? source : join(SERVER_ROOT, `${relative}.js`);
}
var SPAWNED_PROXIES = {
  // The built-in browser and the cloud computer: argv[2] picks which.
  harnessMcp: resolveProxy("harness-mcp-proxy"),
  localComputer: resolveProxy("local-computer-proxy"),
  permission: resolveProxy("permission-proxy"),
  containerMcp: resolveProxy("container-mcp"),
  vpsContainerMcp: resolveProxy("vps-container-mcp"),
  agents: resolveProxy("drivers/agents-proxy"),
  dweb: resolveProxy("drivers/dweb-proxy"),
  connectors: resolveProxy("connector-proxy"),
  mcpGate: resolveProxy("mcp-gate"),
  mcpRemote: resolveProxy("mcp-remote-proxy"),
  phone: resolveProxy("drivers/phone-proxy"),
  hook: resolveProxy("hooks/omb-hook"),
  // Loaded by the external `pi` process via `-e`, not by this server — but
  // resolved through the same single source of truth so the packaged layout
  // check can assert it ships.
  piMcpExtension: resolveProxy("drivers/pi-mcp-extension")
};
export {
  SERVER_ROOT,
  SPAWNED_PROXIES,
  resolveProxy
};
