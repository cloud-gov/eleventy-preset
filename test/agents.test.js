import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { runAgents } from "../src/agents.js";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../bin/studio-eleventy.js", import.meta.url));

async function createSite(t, content = "# Local\r\n\r\nUse actual paths.\r\n") {
  const root = await mkdtemp(path.join(os.tmpdir(), "preset-agents-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "docs"));
  await writeFile(path.join(root, "docs/agents.site.md"), content);
  return root;
}

test("sync joins installed shared and local guidance deterministically without rewriting current output", async (t) => {
  const root = await createSite(t);
  const local = await readFile(path.join(root, "docs/agents.site.md"), "utf8");
  await runAgents(["sync"], root);
  const output = path.join(root, "AGENTS.md");
  const generated = await readFile(output, "utf8");
  const shared = await readFile(new URL("../templates/agents.shared.md", import.meta.url), "utf8");
  const { version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(generated.startsWith("<!-- @studio/eleventy-preset:agents -->\n"));
  assert.ok(generated.includes(`@studio/eleventy-preset@${version}`));
  assert.ok(generated.includes("Generator format: 1"));
  assert.ok(generated.includes(shared.trimEnd()));
  assert.ok(generated.endsWith("# Local\n\nUse actual paths.\n"));
  assert.ok(!generated.includes(root));
  assert.ok(!generated.includes("\r"));
  const before = await stat(output);
  await runAgents(["sync"], root);
  await runAgents(["check"], root);
  const after = await stat(output);
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.equal(after.ino, before.ino);
  assert.equal(await readFile(path.join(root, "docs/agents.site.md"), "utf8"), local);
  assert.deepEqual((await readdir(root)).sort(), ["AGENTS.md", "docs"]);
});

test("check never writes missing or stale output; sync updates changed local guidance", async (t) => {
  const root = await createSite(t);
  await assert.rejects(runAgents(["check"], root), /missing.*studio-eleventy agents sync/);
  assert.deepEqual(await readdir(root), ["docs"]);
  await runAgents(["sync"], root);
  const output = path.join(root, "AGENTS.md");
  const before = await readFile(output, "utf8");
  await writeFile(path.join(root, "docs/agents.site.md"), "# Changed\n");
  await assert.rejects(runAgents(["check"], root), /stale.*studio-eleventy agents sync/);
  assert.equal(await readFile(output, "utf8"), before);
  await runAgents(["sync"], root);
  await runAgents(["check"], root);
  assert.ok((await readFile(output, "utf8")).endsWith("# Changed\n"));
});

test("both commands protect unmanaged instructions, including marker text outside the header", async (t) => {
  const root = await createSite(t);
  const output = path.join(root, "AGENTS.md");
  const original = "# Existing rules\n<!-- @studio/eleventy-preset:agents -->\n";
  await writeFile(output, original);
  for (const command of ["sync", "check"]) {
    await assert.rejects(runAgents([command], root), /unmanaged.*preserve.*rename or remove/);
    assert.equal(await readFile(output, "utf8"), original);
  }
});

test("missing or unreadable local source fails without changing output or discovering other sources", async (t) => {
  const root = await createSite(t);
  await runAgents(["sync"], root);
  const output = path.join(root, "AGENTS.md");
  const before = await readFile(output, "utf8");
  const local = path.join(root, "docs/agents.site.md");
  await rm(local);
  await writeFile(path.join(root, "docs/other.site.md"), "Do not discover this.");
  for (const command of ["sync", "check"]) {
    await assert.rejects(runAgents([command], root), /Cannot read docs\/agents.site.md.*README/);
    assert.equal(await readFile(output, "utf8"), before);
  }
  await mkdir(local);
  await assert.rejects(runAgents(["sync"], root), /Cannot read docs\/agents.site.md/);
  assert.equal(await readFile(output, "utf8"), before);
});

test("CLI runs from the consumer directory and reports failures with nonzero status", async (t) => {
  const root = await createSite(t);
  for (const args of [[], ["unknown"], ["sync", "--force"]]) {
    await assert.rejects(exec(process.execPath, [cli, "agents", ...args], { cwd: root }), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /Usage: studio-eleventy agents/);
      return true;
    });
  }
  await exec(process.execPath, [cli, "agents", "sync"], { cwd: root });
  await exec(process.execPath, [cli, "agents", "check"], { cwd: root });
  await writeFile(path.join(root, "docs/agents.site.md"), "Updated\n");
  await assert.rejects(exec(process.execPath, [cli, "agents", "check"], { cwd: root }), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /stale/);
    return true;
  });
});

test("generation resolves bundled sources relative to its module and detects preset updates", async (t) => {
  const root = await createSite(t, "# Local\nLiteral ${process.cwd()} and {% include 'example' %}.\n");
  const installed = path.join(root, "installed-preset");
  await mkdir(path.join(installed, "src"), { recursive: true });
  await mkdir(path.join(installed, "templates"));
  await copyFile(new URL("../src/agents.js", import.meta.url), path.join(installed, "src/agents.js"));
  const metadata = path.join(installed, "package.json");
  const shared = path.join(installed, "templates/agents.shared.md");
  await writeFile(metadata, JSON.stringify({ type: "module", version: "1.0.0" }));
  await writeFile(shared, "# Shared\r\nOld instructions.\r\n");
  const { runAgents: installedAgents } = await import(pathToFileURL(path.join(installed, "src/agents.js")).href);
  await installedAgents(["sync"], root);
  const output = path.join(root, "AGENTS.md");
  const before = await readFile(output, "utf8");
  assert.ok(before.includes("@studio/eleventy-preset@1.0.0"));
  assert.ok(before.includes("# Shared\nOld instructions.\n\n# Local"));
  assert.ok(before.includes("Literal ${process.cwd()} and {% include 'example' %}."));
  await writeFile(metadata, JSON.stringify({ type: "module", version: "1.1.0" }));
  await assert.rejects(installedAgents(["check"], root), /stale/);
  await installedAgents(["sync"], root);
  assert.ok((await readFile(output, "utf8")).includes("@studio/eleventy-preset@1.1.0"));
  await writeFile(shared, "# New shared guidance\n");
  await assert.rejects(installedAgents(["check"], root), /stale/);
  const previous = await readFile(output, "utf8");
  await rm(shared);
  for (const command of ["sync", "check"]) {
    await assert.rejects(installedAgents([command], root), /Cannot read bundled/);
    assert.equal(await readFile(output, "utf8"), previous);
  }
});
