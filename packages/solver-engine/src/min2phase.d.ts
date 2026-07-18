declare module 'min2phase.js' {
  const min2phase: {
    initFull(): void;
    solve(faceletString: string): string;
  };
  export default min2phase;
}
