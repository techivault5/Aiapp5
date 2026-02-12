import type { ColumnInfo } from './snowflake';

export interface QueryContext {
  database: string;
  schema: string;
  tables: {
    name: string;
    columns: ColumnInfo[];
    rowCount: number;
  }[];
}

interface ParsedIntent {
  action: 'select' | 'count' | 'aggregate' | 'distinct' | 'join';
  tables: string[];
  columns: string[];
  conditions: Condition[];
  aggregations: Aggregation[];
  orderBy: OrderClause[];
  groupBy: string[];
  limit?: number;
  distinct: boolean;
}

interface Condition {
  column: string;
  operator: string;
  value: string;
  conjunction: 'AND' | 'OR';
}

interface Aggregation {
  function: string;
  column: string;
  alias?: string;
}

interface OrderClause {
  column: string;
  direction: 'ASC' | 'DESC';
}

// Keywords mapping for NLP parsing
const ACTION_KEYWORDS: Record<string, ParsedIntent['action']> = {
  show: 'select',
  get: 'select',
  find: 'select',
  list: 'select',
  display: 'select',
  select: 'select',
  fetch: 'select',
  retrieve: 'select',
  count: 'count',
  'how many': 'count',
  total: 'aggregate',
  sum: 'aggregate',
  average: 'aggregate',
  avg: 'aggregate',
  min: 'aggregate',
  max: 'aggregate',
  minimum: 'aggregate',
  maximum: 'aggregate',
  unique: 'distinct',
  distinct: 'distinct',
  different: 'distinct',
  join: 'join',
  combine: 'join',
  merge: 'join',
};

const COMPARISON_KEYWORDS: Record<string, string> = {
  equals: '=',
  'equal to': '=',
  is: '=',
  'is not': '!=',
  'not equal': '!=',
  'greater than': '>',
  'more than': '>',
  above: '>',
  over: '>',
  'less than': '<',
  'fewer than': '<',
  below: '<',
  under: '<',
  'at least': '>=',
  'at most': '<=',
  contains: 'LIKE',
  like: 'LIKE',
  'starts with': 'LIKE_START',
  'ends with': 'LIKE_END',
  between: 'BETWEEN',
  'is null': 'IS NULL',
  'is not null': 'IS NOT NULL',
  'is empty': 'IS NULL',
  'is not empty': 'IS NOT NULL',
  in: 'IN',
};

const ORDER_KEYWORDS: Record<string, 'ASC' | 'DESC'> = {
  ascending: 'ASC',
  asc: 'ASC',
  'a-z': 'ASC',
  'lowest first': 'ASC',
  'oldest first': 'ASC',
  descending: 'DESC',
  desc: 'DESC',
  'z-a': 'DESC',
  'highest first': 'DESC',
  'newest first': 'DESC',
  'top': 'DESC',
  'bottom': 'ASC',
};

const AGG_KEYWORDS: Record<string, string> = {
  total: 'SUM',
  sum: 'SUM',
  'sum of': 'SUM',
  average: 'AVG',
  avg: 'AVG',
  'average of': 'AVG',
  minimum: 'MIN',
  min: 'MIN',
  'min of': 'MIN',
  maximum: 'MAX',
  max: 'MAX',
  'max of': 'MAX',
  count: 'COUNT',
  'count of': 'COUNT',
  'number of': 'COUNT',
};

const LIMIT_PATTERNS = [
  /(?:top|first|limit)\s+(\d+)/i,
  /(\d+)\s+(?:rows|records|results|entries)/i,
];

/**
 * Build SQL from English language input
 */
export function buildQueryFromEnglish(
  englishQuery: string,
  context: QueryContext
): { sql: string; explanation: string; confidence: number } {
  const input = englishQuery.toLowerCase().trim();
  const intent = parseIntent(input, context);
  const sql = generateSQL(intent, context);
  const explanation = generateExplanation(intent, context);
  const confidence = calculateConfidence(intent, context);

  return { sql, explanation, confidence };
}

function parseIntent(input: string, context: QueryContext): ParsedIntent {
  const intent: ParsedIntent = {
    action: 'select',
    tables: [],
    columns: [],
    conditions: [],
    aggregations: [],
    orderBy: [],
    groupBy: [],
    distinct: false,
  };

  // Detect action
  for (const [keyword, action] of Object.entries(ACTION_KEYWORDS)) {
    if (input.includes(keyword)) {
      intent.action = action;
      break;
    }
  }

  // Detect distinct
  if (input.includes('unique') || input.includes('distinct') || input.includes('different')) {
    intent.distinct = true;
  }

  // Match tables from context
  const allTables = context.tables.map((t) => t.name);
  for (const table of allTables) {
    const tableLower = table.toLowerCase();
    // Match exact table name or common singular/plural variants
    if (
      input.includes(tableLower) ||
      input.includes(tableLower.replace(/_/g, ' ')) ||
      input.includes(singularize(tableLower)) ||
      input.includes(pluralize(tableLower))
    ) {
      intent.tables.push(table);
    }
  }

  // Default to first table if none matched
  if (intent.tables.length === 0 && allTables.length > 0) {
    intent.tables.push(allTables[0]);
  }

  // Match columns from context
  const availableColumns = intent.tables.flatMap(
    (t) => context.tables.find((ct) => ct.name === t)?.columns || []
  );

  for (const col of availableColumns) {
    const colLower = col.name.toLowerCase();
    const colReadable = colLower.replace(/_/g, ' ');
    if (input.includes(colLower) || input.includes(colReadable)) {
      intent.columns.push(col.name);
    }
  }

  // Detect aggregations
  for (const [keyword, aggFunc] of Object.entries(AGG_KEYWORDS)) {
    if (input.includes(keyword)) {
      // Find what column the aggregation applies to
      const afterKeyword = input.split(keyword)[1]?.trim() || '';
      let aggColumn = '*';
      for (const col of availableColumns) {
        const colLower = col.name.toLowerCase();
        if (afterKeyword.includes(colLower) || afterKeyword.includes(colLower.replace(/_/g, ' '))) {
          aggColumn = col.name;
          break;
        }
      }
      intent.aggregations.push({
        function: aggFunc,
        column: aggColumn,
        alias: `${aggFunc.toLowerCase()}_${aggColumn.toLowerCase()}`,
      });
    }
  }

  // Detect conditions
  for (const [keyword, operator] of Object.entries(COMPARISON_KEYWORDS)) {
    const idx = input.indexOf(keyword);
    if (idx === -1) continue;

    // Find which column this condition refers to
    const beforeKeyword = input.substring(0, idx).trim();
    let matchedCol = '';
    for (const col of availableColumns) {
      const colLower = col.name.toLowerCase();
      if (beforeKeyword.includes(colLower) || beforeKeyword.includes(colLower.replace(/_/g, ' '))) {
        matchedCol = col.name;
      }
    }

    if (!matchedCol) continue;

    // Extract value after operator keyword
    const afterKeyword = input.substring(idx + keyword.length).trim();
    let value = '';

    if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
      value = '';
    } else if (operator === 'LIKE') {
      const match = afterKeyword.match(/["']([^"']+)["']/) || afterKeyword.match(/^(\S+)/);
      value = match ? `%${match[1]}%` : '';
    } else if (operator === 'LIKE_START') {
      const match = afterKeyword.match(/["']([^"']+)["']/) || afterKeyword.match(/^(\S+)/);
      value = match ? `${match[1]}%` : '';
    } else if (operator === 'LIKE_END') {
      const match = afterKeyword.match(/["']([^"']+)["']/) || afterKeyword.match(/^(\S+)/);
      value = match ? `%${match[1]}` : '';
    } else {
      const match = afterKeyword.match(/["']([^"']+)["']/) || afterKeyword.match(/^(\S+)/);
      value = match ? match[1] : '';
    }

    if (matchedCol && (value || operator === 'IS NULL' || operator === 'IS NOT NULL')) {
      const conjunction = input.includes(' or ') ? 'OR' : 'AND';
      const actualOperator = operator.startsWith('LIKE') ? 'LIKE' : operator;
      intent.conditions.push({ column: matchedCol, operator: actualOperator, value, conjunction });
    }
  }

  // Detect ordering
  for (const [keyword, direction] of Object.entries(ORDER_KEYWORDS)) {
    if (input.includes(keyword)) {
      // Find by which column
      const nearKeyword = input.split(keyword)[0]?.trim() || '';
      let orderCol = intent.columns[0] || availableColumns[0]?.name || '';
      for (const col of availableColumns) {
        const colLower = col.name.toLowerCase();
        if (nearKeyword.includes(colLower) || nearKeyword.includes(colLower.replace(/_/g, ' '))) {
          orderCol = col.name;
        }
      }
      if (orderCol) {
        intent.orderBy.push({ column: orderCol, direction });
      }
      break;
    }
  }

  // Sort by / order by explicit pattern
  const orderByMatch = input.match(/(?:sort|order)\s+by\s+(\w[\w\s]*?)(?:\s+(asc|desc|ascending|descending))?(?:\s|$)/i);
  if (orderByMatch) {
    const colName = orderByMatch[1].trim();
    const dir = orderByMatch[2]?.toLowerCase().startsWith('desc') ? 'DESC' : 'ASC';
    for (const col of availableColumns) {
      if (col.name.toLowerCase() === colName || col.name.toLowerCase().replace(/_/g, ' ') === colName) {
        intent.orderBy = [{ column: col.name, direction: dir }];
        break;
      }
    }
  }

  // Detect limit
  for (const pattern of LIMIT_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      intent.limit = parseInt(match[1], 10);
      break;
    }
  }

  // Group by for aggregations
  if (intent.aggregations.length > 0 && intent.columns.length > 0) {
    intent.groupBy = intent.columns.filter(
      (c) => !intent.aggregations.some((a) => a.column === c)
    );
  }

  return intent;
}

function generateSQL(intent: ParsedIntent, context: QueryContext): string {
  const table = intent.tables[0] || context.tables[0]?.name || 'TABLE';
  const fullTableRef = `"${context.database}"."${context.schema}"."${table}"`;

  let selectClause = '';
  let fromClause = `FROM ${fullTableRef}`;
  let whereClause = '';
  let groupByClause = '';
  let orderByClause = '';
  let limitClause = '';

  // SELECT clause
  if (intent.action === 'count' && intent.aggregations.length === 0) {
    selectClause = 'SELECT COUNT(*)';
  } else if (intent.aggregations.length > 0) {
    const aggParts = intent.aggregations.map(
      (a) => `${a.function}("${a.column}") AS "${a.alias}"`
    );
    const colParts = intent.groupBy.map((c) => `"${c}"`);
    selectClause = `SELECT ${[...colParts, ...aggParts].join(', ')}`;
  } else if (intent.columns.length > 0) {
    const prefix = intent.distinct ? 'SELECT DISTINCT' : 'SELECT';
    selectClause = `${prefix} ${intent.columns.map((c) => `"${c}"`).join(', ')}`;
  } else {
    const prefix = intent.distinct ? 'SELECT DISTINCT' : 'SELECT';
    selectClause = `${prefix} *`;
  }

  // JOIN handling
  if (intent.action === 'join' && intent.tables.length >= 2) {
    const table2 = intent.tables[1];
    const fullTable2Ref = `"${context.database}"."${context.schema}"."${table2}"`;
    const t1Cols = context.tables.find((t) => t.name === table)?.columns || [];
    const t2Cols = context.tables.find((t) => t.name === table2)?.columns || [];

    // Find common columns for join condition
    const commonCols = t1Cols.filter((c1) =>
      t2Cols.some((c2) => c2.name === c1.name)
    );
    const joinCol = commonCols[0]?.name;

    if (joinCol) {
      fromClause = `FROM ${fullTableRef}\nJOIN ${fullTable2Ref} ON ${fullTableRef}."${joinCol}" = ${fullTable2Ref}."${joinCol}"`;
    } else {
      fromClause = `FROM ${fullTableRef}\nCROSS JOIN ${fullTable2Ref}`;
    }
  }

  // WHERE clause
  if (intent.conditions.length > 0) {
    const conditionParts = intent.conditions.map((c, i) => {
      let condStr = '';
      if (c.operator === 'IS NULL' || c.operator === 'IS NOT NULL') {
        condStr = `"${c.column}" ${c.operator}`;
      } else if (c.operator === 'LIKE') {
        condStr = `"${c.column}" LIKE '${c.value}'`;
      } else if (c.operator === 'IN') {
        const values = c.value.split(',').map((v) => `'${v.trim()}'`).join(', ');
        condStr = `"${c.column}" IN (${values})`;
      } else if (!isNaN(Number(c.value))) {
        condStr = `"${c.column}" ${c.operator} ${c.value}`;
      } else {
        condStr = `"${c.column}" ${c.operator} '${c.value}'`;
      }
      return i === 0 ? condStr : `${c.conjunction} ${condStr}`;
    });
    whereClause = `WHERE ${conditionParts.join('\n  ')}`;
  }

  // GROUP BY
  if (intent.groupBy.length > 0) {
    groupByClause = `GROUP BY ${intent.groupBy.map((c) => `"${c}"`).join(', ')}`;
  }

  // ORDER BY
  if (intent.orderBy.length > 0) {
    orderByClause = `ORDER BY ${intent.orderBy.map((o) => `"${o.column}" ${o.direction}`).join(', ')}`;
  }

  // LIMIT
  if (intent.limit) {
    limitClause = `LIMIT ${intent.limit}`;
  }

  const parts = [selectClause, fromClause, whereClause, groupByClause, orderByClause, limitClause]
    .filter(Boolean);

  return parts.join('\n');
}

function generateExplanation(intent: ParsedIntent, context: QueryContext): string {
  const parts: string[] = [];

  if (intent.action === 'count') {
    parts.push(`Counting rows from ${intent.tables[0] || 'table'}`);
  } else if (intent.aggregations.length > 0) {
    const aggDescs = intent.aggregations.map((a) => `${a.function}(${a.column})`);
    parts.push(`Calculating ${aggDescs.join(', ')} from ${intent.tables[0] || 'table'}`);
  } else {
    const colDesc = intent.columns.length > 0 ? intent.columns.join(', ') : 'all columns';
    parts.push(`Selecting ${intent.distinct ? 'distinct ' : ''}${colDesc} from ${intent.tables[0] || 'table'}`);
  }

  if (intent.conditions.length > 0) {
    const condDescs = intent.conditions.map((c) => `${c.column} ${c.operator} ${c.value}`);
    parts.push(`where ${condDescs.join(' and ')}`);
  }

  if (intent.orderBy.length > 0) {
    parts.push(`ordered by ${intent.orderBy.map((o) => `${o.column} ${o.direction}`).join(', ')}`);
  }

  if (intent.limit) {
    parts.push(`limited to ${intent.limit} rows`);
  }

  return parts.join(', ');
}

function calculateConfidence(intent: ParsedIntent, context: QueryContext): number {
  let score = 0.3; // base confidence

  if (intent.tables.length > 0) score += 0.25;
  if (intent.columns.length > 0) score += 0.2;
  if (intent.conditions.length > 0) score += 0.15;
  if (intent.orderBy.length > 0) score += 0.05;
  if (intent.aggregations.length > 0) score += 0.05;

  return Math.min(score, 1.0);
}

// Helpers for singular/plural matching
function singularize(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function pluralize(word: string): string {
  if (word.endsWith('y')) return word.slice(0, -1) + 'ies';
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z')) return word + 'es';
  return word + 's';
}

/**
 * Get query suggestions based on the table context
 */
export function getQuerySuggestions(context: QueryContext): string[] {
  const suggestions: string[] = [];
  const table = context.tables[0];
  if (!table) return suggestions;

  const tableName = table.name.toLowerCase().replace(/_/g, ' ');
  const numericCols = table.columns.filter((c) =>
    ['NUMBER', 'INT', 'INTEGER', 'FLOAT', 'DECIMAL', 'NUMERIC', 'DOUBLE', 'BIGINT'].includes(c.type.toUpperCase())
  );
  const stringCols = table.columns.filter((c) =>
    ['VARCHAR', 'STRING', 'TEXT', 'CHAR'].includes(c.type.toUpperCase())
  );
  const dateCols = table.columns.filter((c) =>
    ['DATE', 'TIMESTAMP', 'TIMESTAMP_LTZ', 'TIMESTAMP_NTZ', 'TIMESTAMP_TZ', 'DATETIME'].includes(c.type.toUpperCase())
  );

  suggestions.push(`Show all ${tableName}`);
  suggestions.push(`Count all ${tableName}`);

  if (numericCols.length > 0) {
    suggestions.push(`Show total ${numericCols[0].name.toLowerCase().replace(/_/g, ' ')} from ${tableName}`);
    suggestions.push(`Show average ${numericCols[0].name.toLowerCase().replace(/_/g, ' ')} from ${tableName}`);
  }

  if (stringCols.length > 0) {
    suggestions.push(`Show unique ${stringCols[0].name.toLowerCase().replace(/_/g, ' ')} from ${tableName}`);
  }

  if (dateCols.length > 0) {
    suggestions.push(`Show ${tableName} order by ${dateCols[0].name.toLowerCase().replace(/_/g, ' ')} descending`);
  }

  suggestions.push(`Show top 10 ${tableName}`);

  return suggestions;
}
