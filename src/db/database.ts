import { open } from '@op-engineering/op-sqlite';
type OpSQLiteConnection = ReturnType<typeof open>;

export type SQLiteBindValue = string | number | null | boolean | Uint8Array | ArrayBuffer;
export interface SQLiteRunResult {
  lastInsertRowId: number;
  changes: number;
}
export interface SQLiteDatabase {
  getFirstAsync<T>(sql: string, ...params: SQLiteBindValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SQLiteBindValue[]): Promise<T[]>;
  runAsync(sql: string, ...params: SQLiteBindValue[]): Promise<SQLiteRunResult>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/**
 * Adapter preserving the Phase 1–3 database API while using OP-SQLite in a
 * plain React Native application. The database filename is unchanged, so the
 * application keeps a stable local SQLite store across app upgrades.
 */
export class NativeSQLiteDatabase implements SQLiteDatabase {
  private readonly connection: OpSQLiteConnection;
  private transactionTail: Promise<void> = Promise.resolve();
  private writeTail: Promise<void> = Promise.resolve();

  constructor(connection: OpSQLiteConnection) {
    this.connection = connection;
  }

  async getFirstAsync<T>(sql: string, ...params: SQLiteBindValue[]): Promise<T | null> {
    const result = await this.connection.execute(sql, params);
    return (result.rows?.[0] as T | undefined) ?? null;
  }

  async getAllAsync<T>(sql: string, ...params: SQLiteBindValue[]): Promise<T[]> {
    const result = await this.connection.execute(sql, params);
    return (result.rows as T[] | undefined) ?? [];
  }

  async runAsync(sql: string, ...params: SQLiteBindValue[]): Promise<SQLiteRunResult> {
    // Keep INSERT and last_insert_rowid() adjacent even if multiple screens write at once.
    const previous = this.writeTail;
    let release!: () => void;
    this.writeTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const result = await this.connection.execute(sql, params);
      let lastInsertRowId = 0;
      if (/^\s*INSERT\b/i.test(sql)) {
        const last = await this.connection.execute('SELECT last_insert_rowid() AS id');
        lastInsertRowId = Number(last.rows?.[0]?.id ?? 0);
      }
      return {
        lastInsertRowId,
        changes: Number(result.rowsAffected ?? 0),
      };
    } finally {
      release();
    }
  }

  async execAsync(sql: string): Promise<void> {
    for (const statement of splitSqlStatements(sql)) {
      if (statement.trim()) await this.connection.execute(statement);
    }
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    // Serialize transaction blocks so two UI actions cannot interleave BEGIN/COMMIT.
    const previous = this.transactionTail;
    let release!: () => void;
    this.transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      await this.connection.execute('BEGIN IMMEDIATE');
      try {
        await task();
        await this.connection.execute('COMMIT');
      } catch (error) {
        try { await this.connection.execute('ROLLBACK'); } catch { /* preserve original error */ }
        throw error;
      }
    } finally {
      release();
    }
  }
}

/** Split a SQL script without splitting semicolons inside strings or comments. */
function splitSqlStatements(source: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let quote: "'" | '"' | '`' | '[' | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (quote === '[' && char === ']') quote = null;
      else if (quote !== '[' && char === quote) {
        if (next === quote) i += 1;
        else quote = null;
      }
      continue;
    }
    if (char === '-' && next === '-') { lineComment = true; i += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; i += 1; continue; }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '[') { quote = '['; continue; }
    if (char === ';') {
      statements.push(source.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = source.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

let databaseSingleton: NativeSQLiteDatabase | null = null;
export function openAppDatabase(): NativeSQLiteDatabase {
  if (!databaseSingleton) {
    databaseSingleton = new NativeSQLiteDatabase(open({ name: 'dota-pro-lab.db' }));
  }
  return databaseSingleton;
}
