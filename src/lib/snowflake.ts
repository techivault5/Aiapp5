import snowflake from 'snowflake-sdk';

export interface SnowflakeConfig {
  account: string;
  username: string;
  privateKey: string;
  warehouse?: string;
  database?: string;
  role?: string;
}

export interface QueryResult {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
  executionTimeMs: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

export interface SchemaInfo {
  database: string;
  schema: string;
  tables: TableInfo[];
}

export interface TableInfo {
  name: string;
  type: 'TABLE' | 'VIEW';
  rowCount: number;
  columns: ColumnInfo[];
}

// Connection pool to reuse connections
const connectionPool = new Map<string, snowflake.Connection>();

function getConnectionKey(config: SnowflakeConfig): string {
  return `${config.account}:${config.username}:${config.database || ''}`;
}

export async function createConnection(config: SnowflakeConfig): Promise<snowflake.Connection> {
  const key = getConnectionKey(config);

  const existing = connectionPool.get(key);
  if (existing && existing.isUp()) {
    return existing;
  }

  const connection = snowflake.createConnection({
    account: config.account,
    username: config.username,
    authenticator: 'SNOWFLAKE_JWT',
    privateKey: config.privateKey,
    warehouse: config.warehouse,
    database: config.database,
    role: config.role,
    clientSessionKeepAlive: true,
    clientSessionKeepAliveHeartbeatFrequency: 3600,
  });

  return new Promise((resolve, reject) => {
    connection.connect((err, conn) => {
      if (err) {
        reject(new Error(`Snowflake connection failed: ${err.message}`));
      } else {
        connectionPool.set(key, conn);
        resolve(conn);
      }
    });
  });
}

export async function executeQuery(
  connection: snowflake.Connection,
  sql: string,
  binds?: unknown[]
): Promise<{ columns: ColumnInfo[]; rows: Record<string, unknown>[] }> {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: sql,
      binds: binds as snowflake.Binds,
      complete: (err, stmt, rows) => {
        if (err) {
          reject(new Error(`Query failed: ${err.message}`));
          return;
        }

        const columns: ColumnInfo[] = stmt.getColumns().map((col) => ({
          name: col.getName(),
          type: col.getType(),
          nullable: col.isNullable(),
        }));

        resolve({ columns, rows: (rows || []) as Record<string, unknown>[] });
      },
    });
  });
}

export async function executePaginatedQuery(
  connection: snowflake.Connection,
  sql: string,
  page: number = 1,
  pageSize: number = 50
): Promise<QueryResult> {
  const startTime = Date.now();

  // Get total count using a subquery wrapper
  const countSql = `SELECT COUNT(*) as TOTAL_COUNT FROM (${sql.replace(/;$/, '')})`;
  let totalRows = 0;
  try {
    const countResult = await executeQuery(connection, countSql);
    totalRows = Number(countResult.rows[0]?.TOTAL_COUNT || 0);
  } catch {
    // If count fails (e.g., DDL statement), proceed without pagination info
    totalRows = -1;
  }

  // Execute paginated query
  const offset = (page - 1) * pageSize;
  const paginatedSql = `${sql.replace(/;$/, '')} LIMIT ${pageSize} OFFSET ${offset}`;

  const result = await executeQuery(connection, paginatedSql);
  const executionTimeMs = Date.now() - startTime;

  const totalPages = totalRows >= 0 ? Math.ceil(totalRows / pageSize) : -1;

  return {
    columns: result.columns,
    rows: result.rows,
    totalRows,
    page,
    pageSize,
    totalPages,
    executionTimeMs,
  };
}

export async function destroyConnection(config: SnowflakeConfig): Promise<void> {
  const key = getConnectionKey(config);
  const conn = connectionPool.get(key);
  if (conn) {
    return new Promise((resolve) => {
      conn.destroy((err) => {
        connectionPool.delete(key);
        resolve();
      });
    });
  }
}
