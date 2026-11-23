import {
  WASAME_TASK_CONTEXT_KEY,
  formatWasameTaskContext,
  validateWasameTaskContext,
  type WasameTaskContext,
} from "../../../shared/wasameTaskContext.js";

export async function getSharedTaskContext(): Promise<WasameTaskContext | null> {
  const stored = await chrome.storage.local.get(WASAME_TASK_CONTEXT_KEY);
  return validateWasameTaskContext(stored[WASAME_TASK_CONTEXT_KEY]);
}

export { formatWasameTaskContext };
