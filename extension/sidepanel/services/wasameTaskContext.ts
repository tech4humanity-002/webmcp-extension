import {
  WASAME_TASK_CONTEXT_KEY,
  formatWasameTaskContext,
  validateWasameTaskContext,
  type WasameTaskContext,
} from "../../../shared/wasameTaskContext.js";

export async function getSharedTaskContext(): Promise<WasameTaskContext | null> {
  const stored = await chrome.storage.local.get(WASAME_TASK_CONTEXT_KEY);
  const value = stored[WASAME_TASK_CONTEXT_KEY];
  if (value === undefined) return null;
  const context = validateWasameTaskContext(value);
  if (!context) throw new Error("Stored WASAME task context failed schema validation");
  return context;
}

export { formatWasameTaskContext };
