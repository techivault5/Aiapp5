import { NextRequest, NextResponse } from 'next/server';
import { createConnection, destroyConnection } from '@/lib/snowflake';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, username, privateKey, warehouse, database, role } = body;

    if (!account || !username || !privateKey) {
      return NextResponse.json(
        { error: 'Account, username, and private key are required' },
        { status: 400 }
      );
    }

    const config = { account, username, privateKey, warehouse, database, role };
    const connection = await createConnection(config);

    // Test the connection with a simple query
    const testResult = await new Promise<boolean>((resolve, reject) => {
      connection.execute({
        sqlText: 'SELECT CURRENT_USER() AS USER, CURRENT_ROLE() AS ROLE, CURRENT_WAREHOUSE() AS WAREHOUSE',
        complete: (err, stmt, rows) => {
          if (err) reject(err);
          else resolve(true);
        },
      });
    });

    return NextResponse.json({
      connected: true,
      message: 'Successfully connected to Snowflake',
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Connection failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, username, database } = body;
    await destroyConnection({ account, username, privateKey: '', database });
    return NextResponse.json({ disconnected: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Disconnect failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
