export interface Solve {
  id: string;
  sessionId: string;
  timeMs: number;
  date: string;
  scramble: string;
  penalty: string;
  method?: string;
}

export interface Session {
  id: string;
  name: string;
  puzzleType: string;
  createdAt: string;
}

export interface Algorithm {
  id: string;
  name: string;
  moves: string;
  subset: string;
  puzzleType: string;
}
