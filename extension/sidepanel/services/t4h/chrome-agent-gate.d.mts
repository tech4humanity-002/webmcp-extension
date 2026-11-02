export interface T4HExecutionReceipt {
  schemaVersion: string;
  runId: string;
  sourceRevision: string;
  environment: string;
  origin: string;
  toolName: string;
  policyDecision: Record<string, unknown>;
  startedAt: string | null;
  finishedAt: string | null;
  outcome: 'success' | 'denied' | 'failed' | 'timeout' | 'unknown';
  resultSummary: unknown;
  errorCode: string | null;
}
export interface T4HGateResult {
  outcome: 'success' | 'denied' | 'failed' | 'timeout' | 'unknown';
  reason?: string;
  value?: unknown;
  receipt: T4HExecutionReceipt;
  evidence: Record<string, unknown>;
}
export function executeThroughT4HPolicy(args: {
  tool: { name: string; description?: string; inputSchema?: Record<string, unknown> | string };
  input: unknown;
  origin: string;
  expectedOrigin?: string;
  allowedOrigins: readonly string[];
  policy: ReadonlyArray<Record<string, unknown>>;
  tabId: number;
  frameId?: number;
  executeTabTool: (name: string, input: Record<string, unknown>, frameId: number, tabId: number, options?: { onTabChanged?: (tabId: number) => void }) => Promise<unknown>;
  onTabChanged?: (tabId: number) => void;
  onBeforeDispatch: (receipt: T4HExecutionReceipt) => Promise<void> | void;
  timeoutMs?: number;
  sourceRevision?: string;
  environment?: string;
}): Promise<T4HGateResult>;
export function matchT4HPolicy(args: { origin: string; tool: unknown; policy?: ReadonlyArray<Record<string, unknown>> }): { allowed: boolean; reason?: string; entry?: Record<string, unknown> };
