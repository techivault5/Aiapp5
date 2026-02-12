import { create } from 'zustand';
import type { ColumnInfo, SchemaInfo, QueryResult } from './snowflake';

export interface ConnectionConfig {
  account: string;
  username: string;
  privateKey: string;
  warehouse: string;
  database: string;
  role: string;
}

interface AppState {
  // Connection
  connectionConfig: ConnectionConfig | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

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

  // Actions
  setConnectionConfig: (config: ConnectionConfig) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setConnectionError: (error: string | null) => void;
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
  reset: () => void;
}

const initialState = {
  connectionConfig: null,
  isConnected: false,
  isConnecting: false,
  connectionError: null,
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
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setConnectionConfig: (config) => set({ connectionConfig: config }),
  setConnected: (connected) => set({ isConnected: connected }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  setConnectionError: (error) => set({ connectionError: error }),
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
  reset: () => set(initialState),
}));
