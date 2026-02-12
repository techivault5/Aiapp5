import { NextRequest, NextResponse } from 'next/server';
import { createConnection, executePaginatedQuery, executeQuery } from '@/lib/snowflake';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, username, privateKey, warehouse, database, role, sql, page, pageSize } = body;

    if (!account || !username || !privateKey) {
      return NextResponse.json(
        { error: 'Connection credentials are required' },
        { status: 400 }
      );
    }

    if (!sql) {
      return NextResponse.json({ error: 'SQL query is required' }, { status: 400 });
    }

    const config = { account, username, privateKey, warehouse, database, role };
    const connection = await createConnection(config);

    const result = await executePaginatedQuery(
      connection,
      sql,
      page || 1,
      pageSize || 50
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: `Query execution failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
