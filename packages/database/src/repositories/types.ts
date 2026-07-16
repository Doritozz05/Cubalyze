export interface Solve {
  id: string;
  sessionId: string;
  timeMs: number;
  date: string;
  scramble: string;
  penalty: string;
  method?: string;
  moves?: unknown[];
  analysisEngineVersion?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Session {
  id: string;
  name: string;
  puzzleType: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Algorithm {
  id: string;
  name: string;
  moves: string[];
  alternatives?: string[][];
  subset: string;
  puzzleType: string;
  createdAt?: string;
  updatedAt?: string;
}
