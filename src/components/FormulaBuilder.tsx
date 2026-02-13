'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useAppStore, FormulaToken, SavedFormula } from '@/lib/store';

// ─── SQL Function Catalog ───────────────────────────────────────────
const FUNCTION_CATALOG: { category: string; icon: string; color: string; fns: { name: string; hint: string; template: string }[] }[] = [
  {
    category: 'Aggregate', icon: 'Σ', color: 'amber',
    fns: [
      { name: 'COUNT', hint: 'Count rows', template: 'COUNT(?)' },
      { name: 'SUM', hint: 'Sum values', template: 'SUM(?)' },
      { name: 'AVG', hint: 'Average', template: 'AVG(?)' },
      { name: 'MIN', hint: 'Minimum', template: 'MIN(?)' },
      { name: 'MAX', hint: 'Maximum', template: 'MAX(?)' },
      { name: 'COUNT DISTINCT', hint: 'Unique count', template: 'COUNT(DISTINCT ?)' },
      { name: 'LISTAGG', hint: 'Concat rows', template: "LISTAGG(?, ',')" },
    ],
  },
  {
    category: 'String', icon: 'Aa', color: 'emerald',
    fns: [
      { name: 'CONCAT', hint: 'Join strings', template: 'CONCAT(?, ?)' },
      { name: 'UPPER', hint: 'Uppercase', template: 'UPPER(?)' },
      { name: 'LOWER', hint: 'Lowercase', template: 'LOWER(?)' },
      { name: 'TRIM', hint: 'Trim spaces', template: 'TRIM(?)' },
      { name: 'LENGTH', hint: 'String length', template: 'LENGTH(?)' },
      { name: 'SUBSTR', hint: 'Substring', template: 'SUBSTR(?, 1, 10)' },
      { name: 'REPLACE', hint: 'Replace text', template: "REPLACE(?, 'old', 'new')" },
      { name: 'SPLIT_PART', hint: 'Split & pick', template: "SPLIT_PART(?, ',', 1)" },
    ],
  },
  {
    category: 'Math', icon: '±', color: 'blue',
    fns: [
      { name: 'ROUND', hint: 'Round to N', template: 'ROUND(?, 2)' },
      { name: 'ABS', hint: 'Absolute val', template: 'ABS(?)' },
      { name: 'CEIL', hint: 'Ceiling', template: 'CEIL(?)' },
      { name: 'FLOOR', hint: 'Floor', template: 'FLOOR(?)' },
      { name: 'MOD', hint: 'Modulo', template: 'MOD(?, ?)' },
      { name: 'POWER', hint: 'Exponent', template: 'POWER(?, 2)' },
      { name: 'SQRT', hint: 'Square root', template: 'SQRT(?)' },
    ],
  },
  {
    category: 'Date', icon: '📅', color: 'purple',
    fns: [
      { name: 'CURRENT_DATE', hint: 'Today', template: 'CURRENT_DATE()' },
      { name: 'DATEADD', hint: 'Add interval', template: "DATEADD('day', 7, ?)" },
      { name: 'DATEDIFF', hint: 'Date diff', template: "DATEDIFF('day', ?, ?)" },
      { name: 'DATE_TRUNC', hint: 'Truncate date', template: "DATE_TRUNC('month', ?)" },
      { name: 'YEAR', hint: 'Extract year', template: 'YEAR(?)' },
      { name: 'MONTH', hint: 'Extract month', template: 'MONTH(?)' },
      { name: 'DAY', hint: 'Extract day', template: 'DAY(?)' },
      { name: 'TO_DATE', hint: 'Parse date', template: "TO_DATE(?, 'YYYY-MM-DD')" },
    ],
  },
  {
    category: 'Conditional', icon: '?:', color: 'rose',
    fns: [
      { name: 'COALESCE', hint: 'First non-null', template: 'COALESCE(?, ?)' },
      { name: 'NVL', hint: 'Null default', template: 'NVL(?, 0)' },
      { name: 'NULLIF', hint: 'Null if equal', template: 'NULLIF(?, 0)' },
      { name: 'IFF', hint: 'If-then-else', template: 'IFF(? > 0, ?, 0)' },
      { name: 'CASE', hint: 'Case switch', template: 'CASE WHEN ? THEN ? ELSE ? END' },
      { name: 'DECODE', hint: 'Map values', template: "DECODE(?, 'A', 1, 'B', 2, 0)" },
    ],
  },
  {
    category: 'Conversion', icon: '⇄', color: 'cyan',
    fns: [
      { name: 'CAST', hint: 'Type cast', template: 'CAST(? AS VARCHAR)' },
      { name: 'TO_NUMBER', hint: 'To number', template: 'TO_NUMBER(?)' },
      { name: 'TO_VARCHAR', hint: 'To string', template: 'TO_VARCHAR(?)' },
      { name: 'TO_TIMESTAMP', hint: 'To timestamp', template: 'TO_TIMESTAMP(?)' },
      { name: 'TRY_CAST', hint: 'Safe cast', template: 'TRY_CAST(? AS NUMBER)' },
    ],
  },
];

const OPERATORS = [
  { label: '+', value: '+', hint: 'Add' },
  { label: '−', value: '-', hint: 'Subtract' },
  { label: '×', value: '*', hint: 'Multiply' },
  { label: '÷', value: '/', hint: 'Divide' },
  { label: '=', value: '=', hint: 'Equal' },
  { label: '≠', value: '<>', hint: 'Not equal' },
  { label: '<', value: '<', hint: 'Less than' },
  { label: '>', value: '>', hint: 'Greater than' },
  { label: '≤', value: '<=', hint: 'Less or equal' },
  { label: '≥', value: '>=', hint: 'Greater or equal' },
  { label: 'AND', value: 'AND', hint: 'Logical AND' },
  { label: 'OR', value: 'OR', hint: 'Logical OR' },
  { label: 'NOT', value: 'NOT', hint: 'Negate' },
  { label: '(', value: '(', hint: 'Open paren' },
  { label: ')', value: ')', hint: 'Close paren' },
  { label: ',', value: ',', hint: 'Separator' },
  { label: '||', value: '||', hint: 'String concat' },
  { label: 'AS', value: 'AS', hint: 'Alias' },
];

let tokenCounter = 0;
function makeToken(type: FormulaToken['type'], value: string, displayName: string, category?: string, dataType?: string): FormulaToken {
  return { id: `ft-${++tokenCounter}-${Date.now()}`, type, value, displayName, category, dataType };
}

// ─── Color helpers ──────────────────────────────────────────────────
function getTypeColor(dataType?: string): string {
  if (!dataType) return 'gray';
  const t = dataType.toUpperCase();
  if (/INT|NUMBER|FLOAT|DOUBLE|DECIMAL|NUMERIC/.test(t)) return 'amber';
  if (/VARCHAR|STRING|TEXT|CHAR/.test(t)) return 'emerald';
  if (/DATE|TIME|TIMESTAMP/.test(t)) return 'blue';
  if (/BOOL/.test(t)) return 'purple';
  return 'gray';
}

function catColor(color: string): string {
  const map: Record<string, string> = {
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    rose: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
    cyan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
    gray: 'bg-white/10 text-gray-400 border-white/10',
  };
  return map[color] || map.gray;
}

function tokenColor(token: FormulaToken): string {
  switch (token.type) {
    case 'field': return catColor(getTypeColor(token.dataType));
    case 'function': return catColor(token.category || 'purple');
    case 'operator': return 'bg-rose-500/15 text-rose-300 border-rose-500/20';
    case 'literal': return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20';
    case 'open_paren': case 'close_paren': return 'bg-white/10 text-gray-300 border-white/10';
    case 'separator': return 'bg-white/10 text-gray-400 border-white/10';
    default: return 'bg-white/10 text-gray-400 border-white/10';
  }
}

// ─── Generate SQL from tokens ───────────────────────────────────────
function tokensToSQL(tokens: FormulaToken[]): string {
  if (tokens.length === 0) return '';
  const parts: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = i > 0 ? tokens[i - 1] : null;
    // No space before comma/close paren, or after open paren
    if (t.type === 'separator' || t.type === 'close_paren') {
      parts.push(t.value);
    } else if (prev && prev.type === 'open_paren') {
      parts.push(t.value);
    } else if (i === 0) {
      parts.push(t.value);
    } else {
      parts.push(' ' + t.value);
    }
  }
  return parts.join('');
}

// ─── Main Component ─────────────────────────────────────────────────
export default function FormulaBuilder() {
  const {
    showFormulaBuilder, setShowFormulaBuilder,
    schemas, selectedDatabase, selectedSchema, selectedTable,
    formulaTokens, addFormulaToken, removeFormulaToken,
    reorderFormulaTokens, clearFormulaTokens, setFormulaTokens,
    savedFormulas, saveFormula, deleteFormula, loadFormula,
    editingFormulaId, setEditingFormulaId,
    addDebugLog, setGeneratedSQL,
  } = useAppStore();

  const [paletteSearch, setPaletteSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Aggregate');
  const [formulaName, setFormulaName] = useState('');
  const [formulaAlias, setFormulaAlias] = useState('');
  const [literalInput, setLiteralInput] = useState('');
  const [showLiteralInput, setShowLiteralInput] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [activeTab, setActiveTab] = useState<'fields' | 'functions' | 'operators' | 'saved'>('fields');
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const dragSourceRef = useRef<{ type: 'palette' | 'canvas'; index?: number } | null>(null);

  // Get available fields from schema
  const availableFields = useMemo(() => {
    if (!selectedDatabase || !selectedSchema) return [];
    const schemaInfo = schemas.find((s) => s.database === selectedDatabase && s.schema === selectedSchema);
    if (!schemaInfo) return [];
    if (selectedTable) {
      const table = schemaInfo.tables.find((t) => t.name === selectedTable);
      return table ? table.columns.map((c) => ({ ...c, table: table.name })) : [];
    }
    return schemaInfo.tables.flatMap((t) => t.columns.map((c) => ({ ...c, table: t.name })));
  }, [schemas, selectedDatabase, selectedSchema, selectedTable]);

  const filteredFields = useMemo(() => {
    if (!paletteSearch) return availableFields;
    const q = paletteSearch.toLowerCase();
    return availableFields.filter((f) => f.name.toLowerCase().includes(q) || f.table.toLowerCase().includes(q));
  }, [availableFields, paletteSearch]);

  const filteredFunctions = useMemo(() => {
    if (!paletteSearch) return FUNCTION_CATALOG;
    const q = paletteSearch.toLowerCase();
    return FUNCTION_CATALOG.map((cat) => ({
      ...cat,
      fns: cat.fns.filter((fn) => fn.name.toLowerCase().includes(q) || fn.hint.toLowerCase().includes(q)),
    })).filter((cat) => cat.fns.length > 0);
  }, [paletteSearch]);

  const generatedSQL = useMemo(() => tokensToSQL(formulaTokens), [formulaTokens]);

  // ─── Drag handlers ──────────────────────────────────────────────
  function handlePaletteDragStart(e: React.DragEvent, token: FormulaToken) {
    dragSourceRef.current = { type: 'palette' };
    e.dataTransfer.setData('application/json', JSON.stringify(token));
    e.dataTransfer.effectAllowed = 'copy';
  }

  function handleCanvasTokenDragStart(e: React.DragEvent, index: number) {
    dragSourceRef.current = { type: 'canvas', index };
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDropZoneDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragSourceRef.current?.type === 'canvas' ? 'move' : 'copy';
    setIsDraggingOver(true);

    // Calculate drop index from mouse position
    if (dropZoneRef.current) {
      const children = Array.from(dropZoneRef.current.querySelectorAll('[data-token-index]'));
      let closest = -1;
      let closestDist = Infinity;
      children.forEach((child, i) => {
        const rect = child.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const dist = Math.abs(e.clientX - centerX);
        if (dist < closestDist) { closestDist = dist; closest = i; }
      });
      if (closest >= 0) {
        const rect = children[closest].getBoundingClientRect();
        const insertAfter = e.clientX > rect.left + rect.width / 2;
        setDragOverIndex(insertAfter ? closest + 1 : closest);
      } else {
        setDragOverIndex(formulaTokens.length);
      }
    }
  }

  function handleDropZoneDragLeave(e: React.DragEvent) {
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
      setDragOverIndex(null);
    }
  }

  function handleDropZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    setDragOverIndex(null);

    if (dragSourceRef.current?.type === 'palette') {
      try {
        const tokenData = JSON.parse(e.dataTransfer.getData('application/json'));
        const newToken = { ...tokenData, id: `ft-${++tokenCounter}-${Date.now()}` };
        if (dragOverIndex !== null && dragOverIndex < formulaTokens.length) {
          const updated = [...formulaTokens];
          updated.splice(dragOverIndex, 0, newToken);
          setFormulaTokens(updated);
        } else {
          addFormulaToken(newToken);
        }
        addDebugLog({ level: 'info', message: `Added ${tokenData.type}: ${tokenData.displayName}` });
      } catch { /* invalid data */ }
    } else if (dragSourceRef.current?.type === 'canvas' && dragSourceRef.current.index !== undefined) {
      const fromIndex = dragSourceRef.current.index;
      if (dragOverIndex !== null && fromIndex !== dragOverIndex) {
        const targetIndex = dragOverIndex > fromIndex ? dragOverIndex - 1 : dragOverIndex;
        reorderFormulaTokens(fromIndex, targetIndex);
      }
    }
    dragSourceRef.current = null;
  }

  // ─── Quick add (click to add) ─────────────────────────────────
  function quickAddField(name: string, table: string, dataType: string) {
    addFormulaToken(makeToken('field', `${table}.${name}`, name, undefined, dataType));
  }

  function quickAddFunction(fn: { name: string; template: string }, category: string, color: string) {
    // Parse template into tokens
    const parts = fn.template.split('?');
    if (parts.length <= 1) {
      // No placeholder - add as single token (e.g. CURRENT_DATE())
      addFormulaToken(makeToken('function', fn.template, fn.name, color));
    } else {
      // Function with placeholders - add function name + parens
      addFormulaToken(makeToken('function', fn.name, fn.name, color));
      addFormulaToken(makeToken('open_paren', '(', '('));
      // Add placeholder for each ? separated by commas
      for (let i = 0; i < parts.length - 1; i++) {
        if (i > 0) addFormulaToken(makeToken('separator', ',', ','));
        const prefix = parts[i].replace(/^[^(]*\(/, '').trim();
        if (prefix) addFormulaToken(makeToken('literal', prefix, prefix));
      }
      const suffix = parts[parts.length - 1].replace(/\)$/, '').trim();
      if (suffix) addFormulaToken(makeToken('literal', suffix, suffix));
      addFormulaToken(makeToken('close_paren', ')', ')'));
    }
  }

  function quickAddOperator(op: { label: string; value: string }) {
    if (op.value === '(') addFormulaToken(makeToken('open_paren', '(', '('));
    else if (op.value === ')') addFormulaToken(makeToken('close_paren', ')', ')'));
    else if (op.value === ',') addFormulaToken(makeToken('separator', ',', ','));
    else addFormulaToken(makeToken('operator', op.value, op.label));
  }

  function addLiteral() {
    if (!literalInput.trim()) return;
    const val = literalInput.trim();
    // If it's a number, add as-is; otherwise wrap in quotes
    const isNum = /^-?\d+\.?\d*$/.test(val);
    addFormulaToken(makeToken('literal', isNum ? val : `'${val}'`, val));
    setLiteralInput('');
    setShowLiteralInput(false);
  }

  function handleSave() {
    if (!formulaName.trim() || formulaTokens.length === 0) return;
    const formula: SavedFormula = {
      id: editingFormulaId || `formula-${Date.now()}`,
      name: formulaName.trim(),
      alias: formulaAlias.trim() || formulaName.trim().toUpperCase().replace(/\s+/g, '_'),
      tokens: [...formulaTokens],
      sql: generatedSQL,
      createdAt: editingFormulaId ? savedFormulas.find((f) => f.id === editingFormulaId)?.createdAt || Date.now() : Date.now(),
    };
    saveFormula(formula);
    addDebugLog({ level: 'success', message: `Formula saved: ${formula.name} → ${formula.sql}` });
    setFormulaName('');
    setFormulaAlias('');
    clearFormulaTokens();
  }

  function handleUseInQuery() {
    if (savedFormulas.length === 0 && formulaTokens.length === 0) return;
    // Build SELECT with all saved formulas plus current
    const parts: string[] = [];
    savedFormulas.forEach((f) => { parts.push(`${f.sql} AS ${f.alias}`); });
    if (formulaTokens.length > 0 && !editingFormulaId) {
      const alias = formulaAlias.trim() || 'CALC_FIELD';
      parts.push(`${generatedSQL} AS ${alias}`);
    }
    if (parts.length === 0) return;
    const table = selectedTable || 'YOUR_TABLE';
    const sql = `SELECT ${parts.join(',\n       ')} FROM ${selectedDatabase}.${selectedSchema}.${table}`;
    setGeneratedSQL(sql);
    addDebugLog({ level: 'sql', message: `Formula applied: ${sql}` });
  }

  function handleEdit(formula: SavedFormula) {
    loadFormula(formula.id);
    setFormulaName(formula.name);
    setFormulaAlias(formula.alias);
    setActiveTab('fields');
  }

  // Keyboard support: delete last token with backspace
  useEffect(() => {
    if (!showFormulaBuilder) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Backspace' && formulaTokens.length > 0 && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        removeFormulaToken(formulaTokens[formulaTokens.length - 1].id);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showFormulaBuilder, formulaTokens, removeFormulaToken]);

  if (!showFormulaBuilder) return null;

  return (
    <div className="card-elevated animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">fx</div>
          <div>
            <h3 className="text-base font-semibold text-gray-100">Formula Builder</h3>
            <p className="text-[11px] text-gray-500">Drag fields & functions to build calculated columns</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600">Backspace to remove last</span>
          <button type="button" className="btn-ghost text-xs" onClick={() => setShowFormulaBuilder(false)}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div className="flex gap-4" style={{ minHeight: 340 }}>
        {/* ─── Left: Palette ───────────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 flex flex-col border border-white/[0.06] rounded-xl bg-white/[0.02] overflow-hidden">
          {/* Palette tabs */}
          <div className="flex border-b border-white/[0.06]">
            {(['fields', 'functions', 'operators', 'saved'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`flex-1 py-2 text-[11px] font-medium transition-all ${activeTab === tab ? 'text-snow-400 bg-white/[0.05] border-b-2 border-snow-400' : 'text-gray-500 hover:text-gray-300'}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'fields' ? 'Fields' : tab === 'functions' ? 'Functions' : tab === 'operators' ? 'Ops' : `Saved (${savedFormulas.length})`}
              </button>
            ))}
          </div>

          {/* Search */}
          {activeTab !== 'operators' && activeTab !== 'saved' && (
            <div className="p-2 border-b border-white/[0.06]">
              <input
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-snow-500/50"
                placeholder={activeTab === 'fields' ? 'Search columns...' : 'Search functions...'}
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
              />
            </div>
          )}

          {/* Palette content */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {activeTab === 'fields' && (
              <>
                {filteredFields.length === 0 && (
                  <div className="text-center py-6 text-gray-600 text-xs">
                    {availableFields.length === 0 ? 'Select a schema to see fields' : 'No matching fields'}
                  </div>
                )}
                {filteredFields.map((field) => {
                  const color = getTypeColor(field.type);
                  const token = makeToken('field', `${field.table}.${field.name}`, field.name, undefined, field.type);
                  return (
                    <div
                      key={`${field.table}.${field.name}`}
                      draggable
                      onDragStart={(e) => handlePaletteDragStart(e, token)}
                      onClick={() => quickAddField(field.name, field.table, field.type)}
                      className="formula-palette-item group"
                      title={`${field.table}.${field.name} (${field.type}) — click or drag to add`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 bg-${color}-400`} />
                        <span className="text-xs text-gray-200 truncate">{field.name}</span>
                      </div>
                      <span className="text-[9px] text-gray-600 flex-shrink-0">{field.type.split('(')[0]}</span>
                    </div>
                  );
                })}
              </>
            )}

            {activeTab === 'functions' && (
              <>
                {filteredFunctions.map((cat) => (
                  <div key={cat.category}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-200 transition-colors"
                      onClick={() => setExpandedCategory(expandedCategory === cat.category ? null : cat.category)}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] border ${catColor(cat.color)}`}>{cat.icon}</span>
                        {cat.category}
                        <span className="text-gray-600 text-[10px]">({cat.fns.length})</span>
                      </span>
                      <svg className={`h-3 w-3 transition-transform ${expandedCategory === cat.category ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {expandedCategory === cat.category && (
                      <div className="ml-2 space-y-0.5 mb-2">
                        {cat.fns.map((fn) => {
                          const token = makeToken('function', fn.name, fn.name, cat.color);
                          return (
                            <div
                              key={fn.name}
                              draggable
                              onDragStart={(e) => handlePaletteDragStart(e, token)}
                              onClick={() => quickAddFunction(fn, cat.category, cat.color)}
                              className="formula-palette-item group"
                              title={`${fn.hint} — ${fn.template}`}
                            >
                              <span className="text-xs text-gray-200">{fn.name}</span>
                              <span className="text-[9px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">{fn.hint}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {activeTab === 'operators' && (
              <div className="grid grid-cols-3 gap-1">
                {OPERATORS.map((op) => {
                  const token = makeToken(
                    op.value === '(' ? 'open_paren' : op.value === ')' ? 'close_paren' : op.value === ',' ? 'separator' : 'operator',
                    op.value, op.label
                  );
                  return (
                    <div
                      key={op.value}
                      draggable
                      onDragStart={(e) => handlePaletteDragStart(e, token)}
                      onClick={() => quickAddOperator(op)}
                      className="formula-op-item"
                      title={op.hint}
                    >
                      <span className="text-xs font-mono font-medium">{op.label}</span>
                    </div>
                  );
                })}
                {/* Literal value button */}
                <div
                  className="formula-op-item col-span-3 justify-center gap-2"
                  onClick={() => setShowLiteralInput(!showLiteralInput)}
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  <span className="text-xs">Add Literal Value</span>
                </div>
                {showLiteralInput && (
                  <div className="col-span-3 flex gap-1 mt-1">
                    <input
                      type="text"
                      className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-snow-500/50"
                      placeholder="Number or text..."
                      value={literalInput}
                      onChange={(e) => setLiteralInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addLiteral(); }}
                      autoFocus
                    />
                    <button type="button" className="btn-primary text-xs px-2 py-1" onClick={addLiteral}>+</button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'saved' && (
              <>
                {savedFormulas.length === 0 && (
                  <div className="text-center py-6 text-gray-600 text-xs">No saved formulas yet</div>
                )}
                {savedFormulas.map((f) => (
                  <div key={f.id} className="formula-saved-item group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-200">{f.name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" className="text-gray-500 hover:text-snow-400 p-0.5" onClick={() => handleEdit(f)} title="Edit">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button type="button" className="text-gray-500 hover:text-red-400 p-0.5" onClick={() => deleteFormula(f.id)} title="Delete">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    <code className="text-[10px] text-gray-500 font-mono block truncate">{f.sql}</code>
                    <span className="text-[9px] text-gray-600 mt-0.5 block">AS {f.alias}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ─── Right: Canvas + Preview ─────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Drop Zone Canvas */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Formula Canvas</span>
              {formulaTokens.length > 0 && (
                <button type="button" className="text-[10px] text-gray-500 hover:text-red-400 transition-colors" onClick={clearFormulaTokens}>Clear All</button>
              )}
            </div>
            <div
              ref={dropZoneRef}
              className={`formula-canvas ${isDraggingOver ? 'formula-canvas-active' : ''} ${formulaTokens.length === 0 ? 'formula-canvas-empty' : ''}`}
              onDragOver={handleDropZoneDragOver}
              onDragLeave={handleDropZoneDragLeave}
              onDrop={handleDropZoneDrop}
            >
              {formulaTokens.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 pointer-events-none select-none">
                  <svg className="h-10 w-10 mb-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  <p className="text-sm font-medium text-gray-600 mb-1">Drop fields & functions here</p>
                  <p className="text-xs text-gray-700">or click items in the palette to add them</p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 p-1">
                  {formulaTokens.map((token, index) => (
                    <div key={token.id} className="flex items-center" data-token-index={index}>
                      {/* Drop indicator */}
                      {dragOverIndex === index && isDraggingOver && (
                        <div className="w-0.5 h-7 bg-snow-400 rounded-full mx-0.5 animate-pulse" />
                      )}
                      <div
                        draggable
                        onDragStart={(e) => handleCanvasTokenDragStart(e, index)}
                        className={`formula-token ${tokenColor(token)} group`}
                      >
                        <span className="text-xs font-medium whitespace-nowrap">{token.displayName}</span>
                        <button
                          type="button"
                          className="ml-1 opacity-0 group-hover:opacity-100 text-current/50 hover:text-current transition-opacity"
                          onClick={(e) => { e.stopPropagation(); removeFormulaToken(token.id); }}
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  {/* Trailing drop indicator */}
                  {dragOverIndex === formulaTokens.length && isDraggingOver && (
                    <div className="w-0.5 h-7 bg-snow-400 rounded-full mx-0.5 animate-pulse" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SQL Preview */}
          {generatedSQL && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Generated Expression</span>
                <button
                  type="button"
                  className="text-[10px] text-gray-500 hover:text-snow-400 transition-colors"
                  onClick={() => { navigator.clipboard.writeText(generatedSQL); }}
                >
                  Copy SQL
                </button>
              </div>
              <pre className="text-sm font-mono text-snow-300 whitespace-pre-wrap break-all leading-relaxed">{generatedSQL}</pre>
            </div>
          )}

          {/* Save / Use controls */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-snow-500/50 flex-1"
              placeholder="Formula name..."
              value={formulaName}
              onChange={(e) => setFormulaName(e.target.value)}
            />
            <input
              type="text"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-snow-500/50 w-36"
              placeholder="SQL alias..."
              value={formulaAlias}
              onChange={(e) => setFormulaAlias(e.target.value)}
            />
            <button
              type="button"
              className="btn-secondary text-xs flex items-center gap-1.5 whitespace-nowrap"
              disabled={formulaTokens.length === 0 || !formulaName.trim()}
              onClick={handleSave}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              {editingFormulaId ? 'Update' : 'Save'}
            </button>
            <button
              type="button"
              className="btn-primary text-xs flex items-center gap-1.5 whitespace-nowrap"
              disabled={savedFormulas.length === 0 && formulaTokens.length === 0}
              onClick={handleUseInQuery}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              Use in Query
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
