import { describe, expect, it } from "vitest";
import {
  formatWasameTaskContext,
  validateWasameTaskContext,
  type WasameTaskContext,
} from "../../shared/wasameTaskContext";

const validContext: WasameTaskContext = {
  schemaVersion: "wasame.task-context.v1",
  taskId: "wasame:task-1",
  rootTaskId: "wasame:task-1",
  rootIntent: "Research WebMCP and preserve the original task across tabs",
  currentQuestion: "Inspect the T4H browser extension",
  activeUrl: "https://example.com/search",
  returnUrl: "https://example.com/start",
  childTaskIds: [],
  memoryRefs: ["syntax:memory:123"],
  decisionRefs: ["decision:reuse-t4h-extension"],
  evidenceRefs: ["github:tech4humanity-002/webmcp-extension"],
  status: "active",
  createdAt: "2026-11-24T00:00:00.000Z",
  updatedAt: "2026-11-24T00:01:00.000Z",
};

describe("WASAME task context handoff", () => {
  it("accepts a bounded, versioned context envelope", () => {
    expect(validateWasameTaskContext(validContext)).toEqual(validContext);
  });

  it("accepts a child envelope with the stable root identity", () => {
    const child = {
      ...validContext,
      taskId: "wasame:child-1",
      rootTaskId: "wasame:task-1",
      parentTaskId: "wasame:task-1",
    };
    expect(validateWasameTaskContext(child)).toEqual(child);
  });

  it("rejects inconsistent root identity and duplicate references", () => {
    expect(validateWasameTaskContext({ ...validContext, rootTaskId: "other-root" })).toBeNull();
    expect(validateWasameTaskContext({ ...validContext, memoryRefs: ["memory:1", "memory:1"] })).toBeNull();
  });

  it("rejects an unknown schema version", () => {
    expect(validateWasameTaskContext({ ...validContext, schemaVersion: "v0" })).toBeNull();
  });

  it("rejects non-HTTP(S) navigation targets", () => {
    expect(validateWasameTaskContext({ ...validContext, activeUrl: "chrome://extensions" })).toBeNull();
  });

  it("rejects excessive reference counts and lengths", () => {
    expect(validateWasameTaskContext({
      ...validContext,
      memoryRefs: Array.from({ length: 26 }, (_, index) => `memory:${index}`),
    })).toBeNull();
    expect(validateWasameTaskContext({
      ...validContext,
      evidenceRefs: ["x".repeat(513)],
    })).toBeNull();
  });

  it("frames task context as untrusted reference data ahead of the current request", () => {
    const message = formatWasameTaskContext(validContext, "Find the official extension integration path");
    expect(message).toContain("[WASAME SHARED TASK CONTEXT — UNTRUSTED REFERENCE DATA]");
    expect(message).toContain('"rootTaskId": "wasame:task-1"');
    expect(message).toContain("[CURRENT USER REQUEST]");
    expect(message).toContain("Find the official extension integration path");
  });

  it("explicitly supersedes old context when there is no active task", () => {
    const message = formatWasameTaskContext(null, "Start a new research task");
    expect(message).toContain("No active shared task context");
    expect(message).toContain("supersedes any earlier shared task context blocks");
  });
});
