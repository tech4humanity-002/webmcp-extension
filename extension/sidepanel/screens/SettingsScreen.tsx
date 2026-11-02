/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useId } from 'react';
import { CloseIcon, DeviceIcon, ShieldIcon } from '../components/Icons.js';
import { Switch } from '../components/Switch.js';

export interface SettingsScreenProps {
  sensitiveActionAlerts: boolean;
  onToggleSensitiveActionAlerts: () => void;
  onDeviceModel: boolean;
  onToggleOnDeviceModel: () => void;
  onDeviceModelSupported: boolean;
  /** A response is being generated, which the model must not change under. */
  responseInProgress?: boolean;
  receiptCount?: number;
  unresolvedReceiptCount?: number;
  policyStatus?: string;
  onExportReceipts?: () => void;
  onClose: () => void;
}

/**
 * SettingsScreen Component
 * Presents settings options, currently featuring the Sensitive action alerts permission toggle.
 */
export function SettingsScreen({
  sensitiveActionAlerts,
  onToggleSensitiveActionAlerts,
  onDeviceModel,
  onToggleOnDeviceModel,
  onDeviceModelSupported,
  responseInProgress = false,
  receiptCount = 0,
  unresolvedReceiptCount = 0,
  policyStatus = 'Not configured',
  onExportReceipts,
  onClose,
}: SettingsScreenProps) {
  const alertsDescId = useId();
  const modelDescId = useId();
  const modelLockedId = useId();
  const modelLocked = onDeviceModelSupported && responseInProgress;

  return (
    <div className="settings-view">
      <div className="settings-card">
        {/* Header */}
        <div className="settings-card__header">
          <h1 className="settings-title">Settings</h1>
          <button
            type="button"
            className="settings-close-btn"
            onClick={onClose}
            aria-label="Close settings"
            title="Close settings"
          >
            <CloseIcon size={20} color="var(--color-blue-title)" />
          </button>
        </div>

        {/* Permissions Section */}
        <div className="settings-section">
          <h2 className="settings-section__title">Permissions</h2>

          <div className="settings-item">
            <div className="settings-item__icon">
              <ShieldIcon size={24} color="var(--color-on-surface-variant)" />
            </div>
            <div className="settings-item__content">
              <span className="settings-item__title">Sensitive action alerts</span>
              <p id={alertsDescId} className="settings-item__desc">
                Get a prompt before tools make changes to your data or accounts. Some external tools may not support this.
              </p>
            </div>
            <div className="settings-item__control">
              <Switch
                checked={sensitiveActionAlerts}
                onChange={onToggleSensitiveActionAlerts}
                aria-label="Sensitive action alerts"
                aria-describedby={alertsDescId}
              />
            </div>
          </div>
        </div>

        {/* T4H execution policy and evidence */}
        <div className="settings-section">
          <h2 className="settings-section__title">T4H execution policy</h2>
          <div className="settings-item settings-item--stacked">
            <div className="settings-item__content">
              <span className="settings-item__title">{policyStatus}</span>
              <p className="settings-item__desc">
                Only exact origin, tool name and input schema matches in the deployment policy can run. This trial allows read-only tools only. Writes and unverified iframe tools are blocked.
              </p>
              <p className="settings-item__desc">
                {receiptCount} capability receipt{receiptCount === 1 ? '' : 's'} stored locally in this extension. Receipts contain execution metadata, not tool inputs or returned page data.
              </p>
              {unresolvedReceiptCount > 0 && (
                <p className="settings-item__desc" role="alert">
                  {unresolvedReceiptCount} execution outcome{unresolvedReceiptCount === 1 ? ' is' : 's are'} pending or unverified. Check the page state before retrying.
                </p>
              )}
              {onExportReceipts && (
                <button
                  type="button"
                  className="settings-export-btn"
                  onClick={onExportReceipts}
                  disabled={receiptCount === 0}
                >
                  Export capability receipts
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Model Section */}
        <div className="settings-section">
          <h2 className="settings-section__title">Model</h2>

          <div className="settings-item">
            <div className="settings-item__icon">
              <DeviceIcon size={24} color="var(--color-on-surface-variant)" />
            </div>
            <div className="settings-item__content">
              <span className="settings-item__title">On-device model</span>
              <p id={modelDescId} className="settings-item__desc">
                {onDeviceModelSupported
                  ? 'Run the model in your browser with the Prompt API, instead of sending prompts and page data to the backend server. No API key needed.'
                  : 'Unavailable: this browser does not expose the Prompt API. Prompts go to the backend server.'}
              </p>
              {modelLocked && (
                <p id={modelLockedId} className="settings-item__desc">
                  Can be changed once the current response has finished.
                </p>
              )}
            </div>
            <div className="settings-item__control">
              <Switch
                checked={onDeviceModel}
                onChange={onToggleOnDeviceModel}
                disabled={!onDeviceModelSupported || responseInProgress}
                aria-label="On-device model"
                aria-describedby={modelLocked ? `${modelDescId} ${modelLockedId}` : modelDescId}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
