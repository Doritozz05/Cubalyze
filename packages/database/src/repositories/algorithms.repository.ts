import type { Algorithm } from './types.js';
import type { AlgorithmCase } from '@cubeforge/algorithm-db';
import type { Algorithm as NewAlgorithm } from '@cubeforge/algorithm-db';

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

export interface AlgorithmCaseRow {
  id: string;
  subset_id: string;
  case_number: string;
  name: string;
  recognition_patterns: string;
  setup_scramble: string;
  setup_algorithm: string | null;
  diagram_type: string;
  diagram_2d: string | null;
  diagram_3d: string | null;
  probability: string | null;
  difficulty: string;
  category: string | null;
  tags: string;
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
    const rows = await this.db('SELECT COUNT(*) as cnt FROM algorithm_cases');
    return (rows[0] as { cnt: number }).cnt;
  }

  // ── New schema: Cases and Algorithm references ──────────────────────

  /**
   * Insert an AlgorithmCase (from @cubeforge/algorithm-db schema).
   * This supports the new canonical schema used by seedIfEmpty().
   */
  async insertCase(c: AlgorithmCase): Promise<void> {
    await this.db(
      `INSERT INTO algorithm_cases
        (id, subset_id, case_number, name, recognition_patterns,
         setup_scramble, setup_algorithm, diagram_type, diagram_2d, diagram_3d,
         probability, difficulty, category, tags, puzzle_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id,
        c.subsetId,
        c.caseNumber,
        c.name,
        JSON.stringify(c.recognitionPatterns),
        c.setupScramble,
        c.setupAlgorithm ?? null,
        c.diagramType,
        c.diagram2D ? JSON.stringify(c.diagram2D) : null,
        c.diagram3D ? JSON.stringify(c.diagram3D) : null,
        c.probability ?? null,
        c.difficulty,
        c.category ?? null,
        JSON.stringify(c.tags),
        c.puzzleType,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
  }

  /**
   * Insert an Algorithm (from @cubeforge/algorithm-db schema).
   * Stores the full algorithm record with moveCount, triggers, etc.
   */
  async insertAlgorithm(a: NewAlgorithm): Promise<void> {
    await this.db(
      `INSERT INTO algorithm_records
        (id, case_id, moves, move_count_htm, move_count_qtm, move_count_stm,
         is_default, source, attribution_name, attribution_url, difficulty,
         triggers, notes, is_mirror, mirror_of, is_inverse, votes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        a.id,
        a.caseId,
        JSON.stringify(a.moves),
        a.moveCount.htm,
        a.moveCount.qtm,
        a.moveCount.stm,
        a.isDefault ? 1 : 0,
        a.source ?? null,
        a.attributionName ?? null,
        a.attributionUrl ?? null,
        a.difficulty,
        JSON.stringify(a.triggers ?? []),
        a.notes ?? null,
        a.isMirror ? 1 : 0,
        a.mirrorOf ?? null,
        a.isInverse ? 1 : 0,
        a.votes ?? null,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
  }
}
