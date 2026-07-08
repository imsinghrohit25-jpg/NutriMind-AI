// Apple Push Notification Service — iOS push notifications.
// Uses HTTP/2 APNs provider API with JWT authentication.

import type { PushPayload, FcmResult } from './fcm.js';

const APNS_HOST = process.env['APNS_ENV'] === 'production'
  ? 'https://api.push.apple.com'
  : 'https://api.sandbox.push.apple.com';

const BUNDLE_ID = process.env['APNS_BUNDLE_ID'] ?? 'com.nutrimind.app';

export async function sendApnsPush(
  deviceToken: string,
  payload: PushPayload,
): Promise<FcmResult> {
  const apnsJwt = process.env['APNS_JWT'];
  if (!apnsJwt) {
    console.warn('[push/apns] APNS_JWT not configured; skipping iOS push');
    return { success: false, error: 'APNS_JWT not set' };
  }

  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: 'default',
      'content-available': 1,
    },
    ...payload.data,
  });

  try {
    const resp = await fetch(`${APNS_HOST}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        authorization:   `bearer ${apnsJwt}`,
        'apns-topic':    BUNDLE_ID,
        'apns-push-type':'alert',
        'apns-priority': '5',
        'content-type':  'application/json',
      },
      body,
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      return { success: false, error: `APNs ${resp.status}: ${errorText}` };
    }

    const apnsId = resp.headers.get('apns-id') ?? undefined;
    return { success: true, messageId: apnsId };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
