/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAllFrameOrigins } from './frameOrigins.js';
import {
  WASAME_TASK_CONTEXT_KEY,
  WASAME_TASK_CONTEXT_PROTOCOL,
  validateWasameTaskContext,
} from '../shared/wasameTaskContext.js';
import {
  getCapabilityReceipts,
  isUnresolvedCapabilityReceipt,
  reconcilePendingCapabilityReceipts,
} from './sidepanel/services/t4h/receiptLedger.js';
import {
  T4H_ALLOWED_ORIGINS,
  T4H_ENVIRONMENT,
  T4H_POLICY_ENABLED,
  T4H_SOURCE_REVISION,
} from './sidepanel/services/t4h/policy.js';

const allowedWasameExtensionIds = new Set(
  (process.env.WASAME_EXTENSION_IDS || '').split(',').map((id) => id.trim()).filter(Boolean),
);

// Allows users to open the side panel by clicking the action icon.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
chrome.action.setBadgeBackgroundColor({ color: '#0c7a92' });

// The manifest's `content_scripts` entry only reaches pages that load after
// the extension is installed. Tabs that were already open (on install, and on
// every update or reload, which cuts their old copy off from the extension)
// would have no content script until they are reloaded, so it is injected into
// them here.
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  for (const { id: tabId } of tabs) {
    if (tabId === undefined) continue;
    chrome.scripting
      .executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] })
      // Pages the extension may not script, e.g. chrome:// and the Web Store.
      .catch(() => {});
  }
});

// Update badge text with the number of tools per tab.
chrome.tabs.onUpdated.addListener((tabId) => updateBadge(tabId));
chrome.webNavigation.onCompleted.addListener(({ tabId }) => updateBadge(tabId));

async function updateBadge(tabId: number): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== tabId) return;
  chrome.action.setBadgeText({ text: '', tabId });
  const fromOrigins = await getAllFrameOrigins(tabId);
  const message = { action: 'LIST_TOOLS', fromOrigins };
  try {
    await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
  } catch (error) {
    // Expected on tabs where the content script cannot run (e.g.
    // chrome://newtab) or has not attached yet. Forwarding it would surface raw
    // Chrome IPC errors in the UI, so it is only logged.
    console.debug('[WebMCP] tabs.sendMessage failed:', error);
  }
}

interface RuntimeMessage {
  action?: string;
  tools?: unknown[];
}

chrome.runtime.onMessage.addListener(
  ({ action, tools }: RuntimeMessage, { tab, frameId }, sendResponse) => {
    if (action === 'GET_FRAME_ID') {
      sendResponse(frameId || 0);
      return;
    }
    if (tools !== undefined && tab?.id) {
      const text = tools.length ? `${tools.length}` : '';
      chrome.action.setBadgeText({ text, tabId: tab.id });
    }
  }
);


/**
 * WASAME may hand off task context and read T4H receipt summaries.
 * This channel never invokes page tools, changes T4H policy, or grants permissions.
 * Chrome only delivers external messages from IDs declared in the generated
 * manifest; the sender ID is checked again here as a second fail-closed gate.
 */
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!sender.id || !allowedWasameExtensionIds.has(sender.id)) {
    sendResponse({ protocol: WASAME_TASK_CONTEXT_PROTOCOL, ok: false, error: 'sender-not-allowlisted' });
    return false;
  }
  if (!message || typeof message !== 'object' || message.protocol !== WASAME_TASK_CONTEXT_PROTOCOL) {
    sendResponse({ protocol: WASAME_TASK_CONTEXT_PROTOCOL, ok: false, error: 'protocol-invalid' });
    return false;
  }

  switch (message.type) {
    case 'wasame:capabilities:get': {
      void (async () => {
        const receipts = await getCapabilityReceipts();
        sendResponse({
          protocol: WASAME_TASK_CONTEXT_PROTOCOL,
          ok: true,
          version: chrome.runtime.getManifest().version,
          sourceRevision: T4H_SOURCE_REVISION,
          environment: T4H_ENVIRONMENT,
          policyEnabled: T4H_POLICY_ENABLED,
          allowedOrigins: [...T4H_ALLOWED_ORIGINS],
          receiptCount: receipts.length,
          unresolvedReceiptCount: receipts.filter(isUnresolvedCapabilityReceipt).length,
          features: ['task-context-handoff', 'read-only-t4h-policy', 'receipt-readback'],
        });
      })().catch((error) => {
        sendResponse({ protocol: WASAME_TASK_CONTEXT_PROTOCOL, ok: false, error: error instanceof Error ? error.message : 'capabilities-unavailable' });
      });
      return true;
    }
    case 'wasame:task-context:set': {
      const context = validateWasameTaskContext(message.context);
      if (!context) {
        sendResponse({ protocol: WASAME_TASK_CONTEXT_PROTOCOL, ok: false, error: 'task-context-invalid' });
        return false;
      }
      void (async () => {
        await chrome.storage.local.set({ [WASAME_TASK_CONTEXT_KEY]: context });
        const stored = await chrome.storage.local.get(WASAME_TASK_CONTEXT_KEY);
        const readback = validateWasameTaskContext(stored[WASAME_TASK_CONTEXT_KEY]);
        if (!readback || readback.taskId !== context.taskId || readback.updatedAt !== context.updatedAt) {
          throw new Error('task-context-readback-failed');
        }
        sendResponse({
          protocol: WASAME_TASK_CONTEXT_PROTOCOL,
          ok: true,
          taskId: readback.taskId,
          rootTaskId: readback.rootTaskId,
          updatedAt: readback.updatedAt,
        });
      })().catch((error) => {
        sendResponse({ protocol: WASAME_TASK_CONTEXT_PROTOCOL, ok: false, error: error instanceof Error ? error.message : 'task-context-store-failed' });
      });
      return true;
    }
    case 'wasame:task-context:clear': {
      void chrome.storage.local.remove(WASAME_TASK_CONTEXT_KEY).then(() => {
        sendResponse({ protocol: WASAME_TASK_CONTEXT_PROTOCOL, ok: true });
      }).catch((error) => {
        sendResponse({ protocol: WASAME_TASK_CONTEXT_PROTOCOL, ok: false, error: error instanceof Error ? error.message : 'task-context-clear-failed' });
      });
      return true;
    }
    case 'wasame:receipts:get': {
      void (async () => {
        await reconcilePendingCapabilityReceipts();
        const receipts = await getCapabilityReceipts();
        const summaries = receipts.slice(-50).map((receipt) => ({
          runId: receipt.runId,
          origin: receipt.origin,
          toolName: receipt.toolName,
          outcome: receipt.outcome,
          sourceRevision: receipt.sourceRevision,
          ...(receipt.startedAt ? { startedAt: receipt.startedAt } : {}),
          ...(receipt.finishedAt ? { finishedAt: receipt.finishedAt } : {}),
          ...(receipt.errorCode ? { errorCode: receipt.errorCode } : {}),
        }));
        sendResponse({
          protocol: WASAME_TASK_CONTEXT_PROTOCOL,
          ok: true,
          receiptCount: receipts.length,
          receipts: summaries,
        });
      })().catch((error) => {
        sendResponse({ protocol: WASAME_TASK_CONTEXT_PROTOCOL, ok: false, error: error instanceof Error ? error.message : 'receipt-read-failed' });
      });
      return true;
    }
    default:
      sendResponse({ protocol: WASAME_TASK_CONTEXT_PROTOCOL, ok: false, error: 'message-type-unsupported' });
      return false;
  }
});
