import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyStaticFiles } from "../../scripts/buildConfig";

const temporaryRoots: string[] = [];

function createFixture(manifest: Record<string, unknown>) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "webmcp-wasame-build-"));
  const outDir = path.join(rootDir, "dist");
  temporaryRoots.push(rootDir);
  fs.mkdirSync(path.join(rootDir, "extension", "icons"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, "extension", "sidepanel"), { recursive: true });
  fs.writeFileSync(path.join(rootDir, "extension", "manifest.json"), JSON.stringify(manifest));
  fs.writeFileSync(path.join(rootDir, "extension", "sidepanel", "index.html"), "<html></html>");
  fs.writeFileSync(path.join(rootDir, "extension", "icons", "icon.svg"), "<svg></svg>");
  return { rootDir, outDir };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("WASAME external messaging build allowlist", () => {
  it("writes only unique, exact extension IDs to externally_connectable", () => {
    const { rootDir, outDir } = createFixture({ manifest_version: 3, name: "WebMCP" });
    copyStaticFiles(rootDir, outDir, ["wasame-id-1", "wasame-id-2", "wasame-id-1", " "]);
    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));
    expect(manifest.externally_connectable).toEqual({ ids: ["wasame-id-1", "wasame-id-2"] });
  });

  it("removes external messaging entirely when no IDs are configured", () => {
    const { rootDir, outDir } = createFixture({
      manifest_version: 3,
      name: "WebMCP",
      externally_connectable: { ids: ["*"] },
    });
    copyStaticFiles(rootDir, outDir, []);
    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));
    expect(manifest.externally_connectable).toBeUndefined();
  });
});
