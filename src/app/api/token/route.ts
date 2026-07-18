/**
 * /api/token — issues a LiveKit JWT for the browser participant
 *
 * GET /api/token?room=checky-room&identity=user-abc123
 * Returns: { token: "eyJ..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function GET(req: NextRequest) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set in .env.local' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const room = searchParams.get('room') ?? 'checky-room';
  const identity = searchParams.get('identity') ?? `user-${Math.random().toString(36).slice(2, 8)}`;

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl: '4h',
  });

  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, room, identity });
}
