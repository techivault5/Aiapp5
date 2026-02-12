import type snowflake from 'snowflake-sdk';
import { executeQuery, type SchemaInfo, type TableInfo, type ColumnInfo } from './snowflake';

/**
 * Scan all databases accessible to the current user
 */
export async function scanDatabases(connection: snowflake.Connection): Promise<string[]> {
  const result = await executeQuery(connection, 'SHOW DATABASES');
  return result.rows.map((row) => String(row.name));
}

/**
 * Scan all schemas within a database
 */
export async function scanSchemas(
  connection: snowflake.Connection,
  database: string
): Promise<string[]> {
  const result = await executeQuery(
    connection,
    `SHOW SCHEMAS IN DATABASE "${database}"`
  );
  return result.rows.map((row) => String(row.name));
}

/**
 * Scan all tables and views within a schema
 */
export async function scanTables(
  connection: snowflake.Connection,
  database: string,
  schema: string
): Promise<TableInfo[]> {
  const result = await executeQuery(
    connection,
    `SELECT TABLE_NAME, TABLE_TYPE, ROW_COUNT
     FROM "${database}".INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = '${schema}'
     ORDER BY TABLE_NAME`
  );

  return result.rows.map((row) => ({
    name: String(row.TABLE_NAME),
    type: String(row.TABLE_TYPE) === 'VIEW' ? 'VIEW' : 'TABLE',
    rowCount: Number(row.ROW_COUNT || 0),
    columns: [],
  }));
}

/**
 * Scan all columns for a specific table
 */
export async function scanColumns(
  connection: snowflake.Connection,
  database: string,
  schema: string,
  table: string
): Promise<ColumnInfo[]> {
  const result = await executeQuery(
    connection,
    `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
     FROM "${database}".INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${table}'
     ORDER BY ORDINAL_POSITION`
  );

  return result.rows.map((row) => ({
    name: String(row.COLUMN_NAME),
    type: String(row.DATA_TYPE),
    nullable: String(row.IS_NULLABLE) === 'YES',
  }));
}

/**
 * Full schema scan - get all schemas with their tables and columns.
 * Uses parallel fetching for speed.
 */
export async function fullSchemaScan(
  connection: snowflake.Connection,
  database: string
): Promise<SchemaInfo[]> {
  const schemas = await scanSchemas(connection, database);

  // Fetch tables for all schemas in parallel
  const schemaInfos = await Promise.all(
    schemas.map(async (schemaName) => {
      const tables = await scanTables(connection, database, schemaName);

      // Fetch columns for all tables in parallel (batched to avoid overload)
      const batchSize = 10;
      for (let i = 0; i < tables.length; i += batchSize) {
        const batch = tables.slice(i, i + batchSize);
        const columnResults = await Promise.all(
          batch.map((table) =>
            scanColumns(connection, database, schemaName, table.name)
          )
        );
        batch.forEach((table, idx) => {
          table.columns = columnResults[idx];
        });
      }

      return {
        database,
        schema: schemaName,
        tables,
      } satisfies SchemaInfo;
    })
  );

  return schemaInfos;
}

/**
 * Get a quick summary of table columns for query building context
 */
export async function getTableContext(
  connection: snowflake.Connection,
  database: string,
  schema: string,
  table: string
): Promise<{ columns: ColumnInfo[]; sampleValues: Record<string, unknown[]>; rowCount: number }> {
  const [columns, countResult, sampleResult] = await Promise.all([
    scanColumns(connection, database, schema, table),
    executeQuery(connection, `SELECT COUNT(*) as CNT FROM "${database}"."${schema}"."${table}"`),
    executeQuery(
      connection,
      `SELECT * FROM "${database}"."${schema}"."${table}" LIMIT 5`
    ),
  ]);

  const rowCount = Number(countResult.rows[0]?.CNT || 0);

  // Build sample values per column for NLP context
  const sampleValues: Record<string, unknown[]> = {};
  for (const col of columns) {
    sampleValues[col.name] = sampleResult.rows.map((row) => row[col.name]).filter((v) => v != null);
  }

  return { columns, sampleValues, rowCount };
}
