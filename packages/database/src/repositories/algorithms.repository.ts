import type { Algorithm } from './types.js';

export interface AlgorithmRow {
  id: string;
  name: string;
  moves: string;
  alternatives: string;
  subset: string;
  puzzle_type: string;
  created_at: string;
  updated_at: string;
}

type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

function rowToAlgorithm(row: AlgorithmRow): Algorithm {
  return {
    id: row.id,
    name: row.name,
    moves: JSON.parse(row.moves) as string[],
    alternatives: JSON.parse(row.alternatives) as string[][],
    subset: row.subset,
    puzzleType: row.puzzle_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AlgorithmsRepository {
  private db: DBExecutor;
  constructor(db: DBExecutor) {
    this.db = db;
  }

  async findAll(subset?: string): Promise<Algorithm[]> {
    let sql = 'SELECT * FROM algorithms';
    const bind: unknown[] = [];
    if (subset) {
      sql += ' WHERE subset = ? ORDER BY name ASC';
      bind.push(subset);
    } else {
      sql += ' ORDER BY name ASC';
    }
    const rows = await this.db(sql, bind);
    return rows.map((r) => rowToAlgorithm(r as unknown as AlgorithmRow));
  }

  async findById(id: string): Promise<Algorithm | null> {
    const rows = await this.db('SELECT * FROM algorithms WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return rowToAlgorithm(rows[0] as unknown as AlgorithmRow);
  }

  async insert(algorithm: Algorithm): Promise<void> {
    await this.db(
      'INSERT INTO algorithms (id, name, moves, alternatives, subset, puzzle_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [algorithm.id, algorithm.name, JSON.stringify(algorithm.moves || []), JSON.stringify(algorithm.alternatives || []), algorithm.subset, algorithm.puzzleType, algorithm.createdAt || new Date().toISOString(), algorithm.updatedAt || new Date().toISOString()]
    );
  }

  async update(algorithm: Algorithm): Promise<void> {
    await this.db(
      'UPDATE algorithms SET name = ?, moves = ?, alternatives = ?, subset = ?, puzzle_type = ?, updated_at = ? WHERE id = ?',
      [algorithm.name, JSON.stringify(algorithm.moves || []), JSON.stringify(algorithm.alternatives || []), algorithm.subset, algorithm.puzzleType, new Date().toISOString(), algorithm.id]
    );
  }

  async delete(id: string): Promise<void> {
    await this.db('DELETE FROM algorithms WHERE id = ?', [id]);
  }

  async count(): Promise<number> {
    const rows = await this.db('SELECT COUNT(*) as cnt FROM algorithms');
    return (rows[0] as { cnt: number }).cnt;
  }
}
