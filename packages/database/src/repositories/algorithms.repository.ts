import type { Algorithm } from './types.js';

export interface AlgorithmRow {
  id: string;
  name: string;
  moves: string;
  subset: string;
  puzzle_type: string;
  created_at: string;
}

type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

function rowToAlgorithm(row: AlgorithmRow): Algorithm {
  return {
    id: row.id,
    name: row.name,
    moves: row.moves,
    subset: row.subset,
    puzzleType: row.puzzle_type,
  };
}

export class AlgorithmsRepository {
  constructor(private db: DBExecutor) {}

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
      'INSERT INTO algorithms (id, name, moves, subset, puzzle_type) VALUES (?, ?, ?, ?, ?)',
      [algorithm.id, algorithm.name, algorithm.moves, algorithm.subset, algorithm.puzzleType]
    );
  }

  async update(algorithm: Algorithm): Promise<void> {
    await this.db(
      'UPDATE algorithms SET name = ?, moves = ?, subset = ?, puzzle_type = ? WHERE id = ?',
      [algorithm.name, algorithm.moves, algorithm.subset, algorithm.puzzleType, algorithm.id]
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
