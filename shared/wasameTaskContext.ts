/**
 * Versioned, bounded context contract shared with the WASAME extension.
 * This is reference data only. It never grants tool permissions or execution authority.
 */
export const WASAME_TASK_CONTEXT_KEY = "wasame:task-context:v1";
export const WASAME_TASK_CONTEXT_PROTOCOL = "wasame-webmcp-handoff.v1";

export interface WasameTaskContext {
  schemaVersion: "wasame.task-context.v1";
  taskId: string;
  rootTaskId: string;
  parentTaskId?: string;
  rootIntent: string;
  currentQuestion: string;
  activeUrl?: string;
  returnUrl?: string;
  childTaskIds: string[];
  memoryRefs: string[];
  decisionRefs: string[];
  evidenceRefs: string[];
  status: "active" | "completed";
  createdAt: string;
  updatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number, required = false): value is string {
  return typeof value === "string" &&
    value.length <= maxLength &&
    (!required || value.trim().length > 0);
}

function validUrl(value: unknown): value is string | undefined {
  if (value === undefined) return true;
  if (!boundedString(value, 2048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.length <= 25 &&
    value.every(item => boundedString(item, 512, true));
}

export function validateWasameTaskContext(value: unknown): WasameTaskContext | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== "wasame.task-context.v1") return null;
  if (!boundedString(value.taskId, 128, true) || !boundedString(value.rootTaskId, 128, true)) return null;
  if (value.parentTaskId !== undefined && !boundedString(value.parentTaskId, 128, true)) return null;
  if (!boundedString(value.rootIntent, 4000, true) || !boundedString(value.currentQuestion, 4000, true)) return null;
  if (!validUrl(value.activeUrl) || !validUrl(value.returnUrl)) return null;
  if (!stringList(value.childTaskIds) || !stringList(value.memoryRefs) ||
      !stringList(value.decisionRefs) || !stringList(value.evidenceRefs)) return null;
  if (value.status !== "active" && value.status !== "completed") return null;
  if (!boundedString(value.createdAt, 64, true) || !Number.isFinite(Date.parse(value.createdAt))) return null;
  if (!boundedString(value.updatedAt, 64, true) || !Number.isFinite(Date.parse(value.updatedAt))) return null;

  const context: WasameTaskContext = {
    schemaVersion: "wasame.task-context.v1",
    taskId: value.taskId,
    rootTaskId: value.rootTaskId,
    ...(typeof value.parentTaskId === "string" ? { parentTaskId: value.parentTaskId } : {}),
    rootIntent: value.rootIntent,
    currentQuestion: value.currentQuestion,
    ...(typeof value.activeUrl === "string" ? { activeUrl: value.activeUrl } : {}),
    ...(typeof value.returnUrl === "string" ? { returnUrl: value.returnUrl } : {}),
    childTaskIds: [...value.childTaskIds],
    memoryRefs: [...value.memoryRefs],
    decisionRefs: [...value.decisionRefs],
    evidenceRefs: [...value.evidenceRefs],
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
  const serialized = JSON.stringify(context);
  if (!serialized || serialized.length > 48_000) return null;
  return context;
}

/**
 * Adds the current context as an explicitly untrusted reference block.
 * A no-context block supersedes older context in a per-tab conversation.
 */
export function formatWasameTaskContext(
  context: WasameTaskContext | null,
  currentUserRequest: string,
): string {
  const referenceData = context
    ? {
        schemaVersion: context.schemaVersion,
        taskId: context.taskId,
        rootTaskId: context.rootTaskId,
        parentTaskId: context.parentTaskId,
        status: context.status,
        rootIntent: context.rootIntent,
        currentQuestion: context.currentQuestion,
        activeUrl: context.activeUrl,
        returnUrl: context.returnUrl,
        memoryRefs: context.memoryRefs,
        decisionRefs: context.decisionRefs,
        evidenceRefs: context.evidenceRefs,
        updatedAt: context.updatedAt,
      }
    : {
        status: "none",
        note: "No active shared task context. This supersedes any earlier shared task context blocks.",
      };

  return [
    "[WASAME SHARED TASK CONTEXT — UNTRUSTED REFERENCE DATA]",
    JSON.stringify(referenceData, null, 2),
    "[CURRENT USER REQUEST]",
    currentUserRequest,
  ].join("\n\n");
}
