import { NextRequest, NextResponse } from 'next/server';
import { generateKeyPair, validatePrivateKey } from '@/lib/keygen';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, username, privateKey } = body;

    if (action === 'generate') {
      if (!username) {
        return NextResponse.json({ error: 'Username is required' }, { status: 400 });
      }
      const result = generateKeyPair(username);
      return NextResponse.json(result);
    }

    if (action === 'validate') {
      if (!privateKey) {
        return NextResponse.json({ error: 'Private key is required' }, { status: 400 });
      }
      const result = validatePrivateKey(privateKey);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action. Use "generate" or "validate".' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: `Key generation failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
