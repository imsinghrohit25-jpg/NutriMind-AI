// Firebase Cloud Messaging — Android push notifications.
// Uses FCM v1 HTTP API (OAuth2 token, not legacy server key).
// Gate requirement: scheduled job → real push on device.

export interface PushPayload {
  title: string;
  body:  string;
  data?: Record<string, string>;
}

export interface FcmResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// FCM v1 endpoint — project ID read from env
const FCM_ENDPOINT = `https://fcm.googleapis.com/v1/projects/${
  process.env['FIREBASE_PROJECT_ID'] ?? 'nutrimind'
}/messages:send`;

export async function sendPush(
  fcmToken: string,
  payload: PushPayload,
): Promise<FcmResult> {
  const accessToken = process.env['FCM_ACCESS_TOKEN'];
  if (!accessToken) {
    console.warn('[push/fcm] FCM_ACCESS_TOKEN not configured; skipping push');
    return { success: false, error: 'FCM_ACCESS_TOKEN not set' };
  }

  const body = JSON.stringify({
    message: {
      token: fcmToken,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
      android: {
        priority: 'normal',
        notification: { channel_id: 'nutrimind_weekly' },
      },
    },
  });

  try {
    const resp = await fetch(FCM_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      return { success: false, error: `FCM ${resp.status}: ${errorText}` };
    }

    const json = (await resp.json()) as { name?: string };
    return { success: true, messageId: json.name };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
