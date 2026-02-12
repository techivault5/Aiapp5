import { NextRequest, NextResponse } from 'next/server';
import { createConnection } from '@/lib/snowflake';
import { scanDatabases, scanSchemas, scanTables, scanColumns, fullSchemaScan } from '@/lib/schema-scanner';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, account, username, privateKey, warehouse, database, role, schema, table } = body;

    if (!account || !username || !privateKey) {
      return NextResponse.json(
        { error: 'Connection credentials are required' },
        { status: 400 }
      );
    }

    const config = { account, username, privateKey, warehouse, database, role };
    const connection = await createConnection(config);

    switch (action) {
      case 'databases': {
        const databases = await scanDatabases(connection);
        return NextResponse.json({ databases });
      }

      case 'schemas': {
        if (!database) {
          return NextResponse.json({ error: 'Database is required' }, { status: 400 });
        }
        const schemas = await scanSchemas(connection, database);
        return NextResponse.json({ schemas });
      }

      case 'tables': {
        if (!database || !schema) {
          return NextResponse.json({ error: 'Database and schema are required' }, { status: 400 });
        }
        const tables = await scanTables(connection, database, schema);
        return NextResponse.json({ tables });
      }

      case 'columns': {
        if (!database || !schema || !table) {
          return NextResponse.json(
            { error: 'Database, schema, and table are required' },
            { status: 400 }
          );
        }
        const columns = await scanColumns(connection, database, schema, table);
        return NextResponse.json({ columns });
      }

      case 'full-scan': {
        if (!database) {
          return NextResponse.json({ error: 'Database is required' }, { status: 400 });
        }
        const result = await fullSchemaScan(connection, database);
        return NextResponse.json({ schemas: result });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use databases, schemas, tables, columns, or full-scan' },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Schema scan failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
