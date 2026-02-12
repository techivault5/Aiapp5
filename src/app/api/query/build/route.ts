import { NextRequest, NextResponse } from 'next/server';
import { buildQueryFromEnglish, getQuerySuggestions, type QueryContext } from '@/lib/query-builder';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { englishQuery, context } = body as {
      englishQuery: string;
      context: QueryContext;
    };

    if (!englishQuery) {
      return NextResponse.json({ error: 'English query is required' }, { status: 400 });
    }

    if (!context || !context.database || !context.schema || !context.tables) {
      return NextResponse.json(
        { error: 'Query context (database, schema, tables) is required' },
        { status: 400 }
      );
    }

    const result = buildQueryFromEnglish(englishQuery, context);
    const suggestions = getQuerySuggestions(context);

    return NextResponse.json({
      ...result,
      suggestions,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Query building failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
