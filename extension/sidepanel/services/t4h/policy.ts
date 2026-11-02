/**
 * Build-time T4H policy. This is deployment-owned configuration, not page
 * metadata. A normal build has no allowed origin until T4H_TRIAL_ORIGIN is
 * explicitly supplied. The only enabled trial capability is read-only
 * get_flights on that exact origin.
 */
export const T4H_POLICY_ENABLED = process.env.T4H_POLICY_ENABLED === 'true';
export const T4H_TRIAL_ORIGIN = process.env.T4H_TRIAL_ORIGIN || '';
export const T4H_SOURCE_REVISION = process.env.T4H_SOURCE_REVISION || 'UNPINNED';
export const T4H_ENVIRONMENT = T4H_TRIAL_ORIGIN ? 'TEST' : 'DEV';

export const T4H_ALLOWED_ORIGINS = Object.freeze(
  T4H_POLICY_ENABLED && T4H_TRIAL_ORIGIN ? [T4H_TRIAL_ORIGIN] : [],
);

export const T4H_ALLOWED_TOOLS = Object.freeze([
  Object.freeze({
    origin: T4H_TRIAL_ORIGIN,
    name: 'get_flights',
    risk: 'read-only',
    inputSchema: Object.freeze({
      type: 'object',
      properties: Object.freeze({
        destination: Object.freeze({ type: 'string' }),
      }),
    }),
  }),
]);
