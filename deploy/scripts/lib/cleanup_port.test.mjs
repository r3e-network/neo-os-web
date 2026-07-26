import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { requireTool } from "./required_tool.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const script = path.join(repoRoot, "platform/host-app/scripts/cleanup-port.sh");

function runCleanup(port) {
  return spawnSync("bash", [script, String(port)], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// Binds a real listener in a child process so the script has something to find.
// The child is a detached `node -e` rather than an in-process server, because the
// script kills by pid and killing the test runner itself would be unhelpful.
function spawnListener() {
  const child = spawnSync(
    "node",
    [
      "-e",
      `const net=require('net');const s=net.createServer();s.listen(0,'127.0.0.1',()=>{
         const {port}=s.address();
         const {spawn}=require('child_process');
         const held=spawn(process.execPath,['-e',
           "const net=require('net');const s=net.createServer();s.listen(" + port + ",'127.0.0.1',()=>{setTimeout(()=>{},60000)});"
         ],{detached:true,stdio:'ignore'});
         s.close(()=>{setTimeout(()=>{process.stdout.write(JSON.stringify({port,pid:held.pid}));held.unref();process.exit(0)},400)});
       });`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}

function portIsListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

test("cleanup-port.sh exits cleanly when nothing is listening", () => {
  // Port 0 is never bound, so this exercises the empty-pid-list path -- the one
  // that used to hinge on an unquoted string being empty.
  const result = runCleanup(1);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "");
});

test("cleanup-port.sh kills a real listener on the requested port", async (t) => {
  // cleanup-port.sh finds the listener with lsof, so without it the script has
  // nothing to work from and this gate cannot run at all.
  if (requireTool(t, "lsof", { purpose: "let cleanup-port.sh find the listener" }) === null) {
    return;
  }

  const { port, pid } = spawnListener();
  t.after(() => {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Already gone, which is the expected outcome.
    }
  });

  assert.equal(await portIsListening(port), true, "listener failed to come up");

  const result = runCleanup(port);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`killing listeners on :${port}`));

  assert.equal(await portIsListening(port), false, "port still accepting connections");
});
