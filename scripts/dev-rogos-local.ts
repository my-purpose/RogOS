/** Local-only stack. Docker volume survives normal shutdown. */
import { fileURLToPath } from "node:url";
const cwd = fileURLToPath(new URL("..", import.meta.url));
const compose = ["docker", "compose", "-f", "dev/compose.rogos.yml"];
const env = {
  ...process.env,
  API_HOST: "127.0.0.1", API_PORT: "3004",
  REDIS_PROVIDER: "redis-url", REDIS_URL: "redis://127.0.0.1:6384",
  REALTIME_PROVIDER: "local", VITE_REALTIME_PROVIDER: "local",
  APP_PUBLIC_ORIGIN: "http://127.0.0.1:5174",
  VITE_APP_PUBLIC_ORIGIN: "http://127.0.0.1:5174",
  API_ALLOWED_ORIGINS: "http://127.0.0.1:5174",
  STANDALONE_API_PROXY_TARGET: "http://127.0.0.1:3004",
  IP_GEOLOCATION_DISABLED: "true",
};
const children: ReturnType<typeof Bun.spawn>[] = [];
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  await Promise.all(children.map(child => child.exited));
  await Bun.spawn([...compose, "stop"], { cwd, stdout: "inherit", stderr: "inherit" }).exited;
  process.exit(code);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
// Refuse occupied application ports before starting or stopping any stack service.
for (const port of [3004, 5174]) {
  const probe = Bun.listen({ hostname: "127.0.0.1", port, socket: { data() {} } });
  probe.stop(true);
}
const started = await Bun.spawn([...compose, "up", "-d", "--wait"], { cwd, stdout: "inherit", stderr: "inherit" }).exited;
if (started !== 0) process.exit(started);
function start(args: string[]) {
  const child = Bun.spawn([process.execPath, ...args], { cwd, env, stdout: "inherit", stderr: "inherit" });
  children.push(child);
  child.exited.then(code => { if (!stopping) void stop(code || 1); });
  return child;
}
start(["scripts/api-standalone-server.ts"]);
let ready = false;
for (let i = 0; i < 60 && !stopping; i++) {
  try { ready = (await fetch("http://127.0.0.1:3004/health", { signal: AbortSignal.timeout(2000) })).ok; } catch { /* API still starting */ }
  if (ready) break;
  await Bun.sleep(500);
}
if (!ready) await stop(1);
const version = await Bun.spawn([process.execPath, "scripts/generate-build-version.ts"], { cwd, env, stdout: "inherit", stderr: "inherit" }).exited;
if (version !== 0) await stop(1);
// Spawn the actual server, not a shell wrapper that can leave Vite orphaned.
start(["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5174", "--strictPort"]);
console.log("RogOS local stack: http://127.0.0.1:5174 (Ctrl+C stops services; data retained)");
