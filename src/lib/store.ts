import { create } from 'zustand';
import type { ColumnInfo, SchemaInfo, QueryResult } from './snowflake';

export interface FormulaToken {
  id: string;
  type: 'field' | 'function' | 'operator' | 'literal' | 'open_paren' | 'close_paren' | 'separator';
  value: string;
  displayName: string;
  category?: string;
  dataType?: string;
}

export interface SavedFormula {
  id: string;
  name: string;
  alias: string;
  tokens: FormulaToken[];
  sql: string;
  createdAt: number;
}

export interface ConnectionConfig {
  account: string;
  username: string;
  privateKey: string;
  warehouse: string;
  database: string;
  role: string;
}

export interface QueryHistoryEntry {
  id: string;
  englishQuery: string;
  sql: string;
  timestamp: number;
  executionTimeMs: number;
  totalRows: number;
  status: 'success' | 'error';
  error?: string;
}

export interface DebugLogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'success' | 'error' | 'warn' | 'sql' | 'timing';
  message: string;
  detail?: string;
}

export interface ColumnStats {
  column: string;
  type: string;
  nullCount: number;
  distinctCount: number;
  totalCount: number;
  minValue?: string;
  maxValue?: string;
  avgValue?: string;
}

interface AppState {
  // Connection
  connectionConfig: ConnectionConfig | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  connectionLatencyMs: number | null;
  lastPingMs: number | null;

  // Schema
  databases: string[];
  selectedDatabase: string | null;
  schemas: SchemaInfo[];
  selectedSchema: string | null;
  selectedTable: string | null;
  isScanning: boolean;
  scanProgress: string;

  // Query
  englishQuery: string;
  generatedSQL: string;
  queryExplanation: string;
  queryConfidence: number;
  isBuilding: boolean;

  // Results
  queryResult: QueryResult | null;
  isExecuting: boolean;
  queryError: string | null;
  currentPage: number;
  pageSize: number;

  // Debug
  debugLogs: DebugLogEntry[];
  showDebugPanel: boolean;

  // Query History
  queryHistory: QueryHistoryEntry[];
  showQueryHistory: boolean;

  // Column Stats / Validation
  columnStats: ColumnStats[];
  isValidating: boolean;
  validatedRowCount: number | null;
  showColumnStats: boolean;

  // Table Preview
  previewData: { columns: ColumnInfo[]; rows: Record<string, unknown>[] } | null;
  showPreview: boolean;
  isLoadingPreview: boolean;

  // Command palette
  showCommandPalette: boolean;

  // Formula Builder
  showFormulaBuilder: boolean;
  formulaTokens: FormulaToken[];
  savedFormulas: SavedFormula[];
  editingFormulaId: string | null;

  // Actions
  setConnectionConfig: (config: ConnectionConfig) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setConnectionError: (error: string | null) => void;
  setConnectionLatencyMs: (ms: number | null) => void;
  setLastPingMs: (ms: number | null) => void;
  setDatabases: (databases: string[]) => void;
  setSelectedDatabase: (database: string | null) => void;
  setSchemas: (schemas: SchemaInfo[]) => void;
  setSelectedSchema: (schema: string | null) => void;
  setSelectedTable: (table: string | null) => void;
  setScanning: (scanning: boolean) => void;
  setScanProgress: (progress: string) => void;
  setEnglishQuery: (query: string) => void;
  setGeneratedSQL: (sql: string) => void;
  setQueryExplanation: (explanation: string) => void;
  setQueryConfidence: (confidence: number) => void;
  setBuilding: (building: boolean) => void;
  setQueryResult: (result: QueryResult | null) => void;
  setExecuting: (executing: boolean) => void;
  setQueryError: (error: string | null) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  addDebugLog: (entry: Omit<DebugLogEntry, 'id' | 'timestamp'>) => void;
  clearDebugLogs: () => void;
  setShowDebugPanel: (show: boolean) => void;
  addQueryHistory: (entry: Omit<QueryHistoryEntry, 'id'>) => void;
  clearQueryHistory: () => void;
  setShowQueryHistory: (show: boolean) => void;
  setColumnStats: (stats: ColumnStats[]) => void;
  setIsValidating: (v: boolean) => void;
  setValidatedRowCount: (count: number | null) => void;
  setShowColumnStats: (show: boolean) => void;
  setPreviewData: (data: { columns: ColumnInfo[]; rows: Record<string, unknown>[] } | null) => void;
  setShowPreview: (show: boolean) => void;
  setIsLoadingPreview: (v: boolean) => void;
  setShowCommandPalette: (show: boolean) => void;
  setShowFormulaBuilder: (show: boolean) => void;
  setFormulaTokens: (tokens: FormulaToken[]) => void;
  addFormulaToken: (token: FormulaToken) => void;
  removeFormulaToken: (id: string) => void;
  reorderFormulaTokens: (fromIndex: number, toIndex: number) => void;
  saveFormula: (formula: SavedFormula) => void;
  deleteFormula: (id: string) => void;
  loadFormula: (id: string) => void;
  clearFormulaTokens: () => void;
  setEditingFormulaId: (id: string | null) => void;
  reset: () => void;
}

const initialState = {
  connectionConfig: null,
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  connectionLatencyMs: null,
  lastPingMs: null,
  databases: [],
  selectedDatabase: null,
  schemas: [],
  selectedSchema: null,
  selectedTable: null,
  isScanning: false,
  scanProgress: '',
  englishQuery: '',
  generatedSQL: '',
  queryExplanation: '',
  queryConfidence: 0,
  isBuilding: false,
  queryResult: null,
  isExecuting: false,
  queryError: null,
  currentPage: 1,
  pageSize: 50,
  debugLogs: [],
  showDebugPanel: false,
  queryHistory: [],
  showQueryHistory: false,
  columnStats: [],
  isValidating: false,
  validatedRowCount: null,
  showColumnStats: false,
  previewData: null,
  showPreview: false,
  isLoadingPreview: false,
  showCommandPalette: false,
  showFormulaBuilder: false,
  formulaTokens: [],
  savedFormulas: [],
  editingFormulaId: null,
};

let logCounter = 0;

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setConnectionConfig: (config) => set({ connectionConfig: config }),
  setConnected: (connected) => set({ isConnected: connected }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  setConnectionError: (error) => set({ connectionError: error }),
  setConnectionLatencyMs: (ms) => set({ connectionLatencyMs: ms }),
  setLastPingMs: (ms) => set({ lastPingMs: ms }),
  setDatabases: (databases) => set({ databases }),
  setSelectedDatabase: (database) => set({ selectedDatabase: database }),
  setSchemas: (schemas) => set({ schemas }),
  setSelectedSchema: (schema) => set({ selectedSchema: schema }),
  setSelectedTable: (table) => set({ selectedTable: table }),
  setScanning: (scanning) => set({ isScanning: scanning }),
  setScanProgress: (progress) => set({ scanProgress: progress }),
  setEnglishQuery: (query) => set({ englishQuery: query }),
  setGeneratedSQL: (sql) => set({ generatedSQL: sql }),
  setQueryExplanation: (explanation) => set({ queryExplanation: explanation }),
  setQueryConfidence: (confidence) => set({ queryConfidence: confidence }),
  setBuilding: (building) => set({ isBuilding: building }),
  setQueryResult: (result) => set({ queryResult: result }),
  setExecuting: (executing) => set({ isExecuting: executing }),
  setQueryError: (error) => set({ queryError: error }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size }),
  addDebugLog: (entry) =>
    set((state) => ({
      debugLogs: [
        ...state.debugLogs,
        { ...entry, id: `log-${++logCounter}`, timestamp: Date.now() },
      ].slice(-200),
    })),
  clearDebugLogs: () => set({ debugLogs: [] }),
  setShowDebugPanel: (show) => set({ showDebugPanel: show }),
  addQueryHistory: (entry) =>
    set((state) => ({
      queryHistory: [
        { ...entry, id: `qh-${Date.now()}` },
        ...state.queryHistory,
      ].slice(0, 50),
    })),
  clearQueryHistory: () => set({ queryHistory: [] }),
  setShowQueryHistory: (show) => set({ showQueryHistory: show }),
  setColumnStats: (stats) => set({ columnStats: stats }),
  setIsValidating: (v) => set({ isValidating: v }),
  setValidatedRowCount: (count) => set({ validatedRowCount: count }),
  setShowColumnStats: (show) => set({ showColumnStats: show }),
  setPreviewData: (data) => set({ previewData: data }),
  setShowPreview: (show) => set({ showPreview: show }),
  setIsLoadingPreview: (v) => set({ isLoadingPreview: v }),
  setShowCommandPalette: (show) => set({ showCommandPalette: show }),
  setShowFormulaBuilder: (show) => set({ showFormulaBuilder: show }),
  setFormulaTokens: (tokens) => set({ formulaTokens: tokens }),
  addFormulaToken: (token) =>
    set((state) => ({ formulaTokens: [...state.formulaTokens, token] })),
  removeFormulaToken: (id) =>
    set((state) => ({ formulaTokens: state.formulaTokens.filter((t) => t.id !== id) })),
  reorderFormulaTokens: (fromIndex, toIndex) =>
    set((state) => {
      const tokens = [...state.formulaTokens];
      const [moved] = tokens.splice(fromIndex, 1);
      tokens.splice(toIndex, 0, moved);
      return { formulaTokens: tokens };
    }),
  saveFormula: (formula) =>
    set((state) => {
      const existing = state.savedFormulas.findIndex((f) => f.id === formula.id);
      if (existing >= 0) {
        const updated = [...state.savedFormulas];
        updated[existing] = formula;
        return { savedFormulas: updated, editingFormulaId: null };
      }
      return { savedFormulas: [...state.savedFormulas, formula], editingFormulaId: null };
    }),
  deleteFormula: (id) =>
    set((state) => ({ savedFormulas: state.savedFormulas.filter((f) => f.id !== id) })),
  loadFormula: (id) =>
    set((state) => {
      const formula = state.savedFormulas.find((f) => f.id === id);
      if (formula) return { formulaTokens: [...formula.tokens], editingFormulaId: id };
      return {};
    }),
  clearFormulaTokens: () => set({ formulaTokens: [], editingFormulaId: null }),
  setEditingFormulaId: (id) => set({ editingFormulaId: id }),
  reset: () => set(initialState),
}));
