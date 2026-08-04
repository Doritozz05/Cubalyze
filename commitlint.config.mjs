// Conventional Commits enforcement — superset of docs/08-standards/Git_Workflow.md.
// The 8 documented types (feat, fix, docs, style, refactor, perf, test, chore)
// plus build/ci/revert so `git revert` and czg's full palette are never
// rejected by the hook.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'build', 'ci', 'revert'],
    ],
    // Scope is optional but when present must be kebab-case (e.g. feat(hal): …)
    'scope-case': [2, 'always', 'kebab-case'],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0],
  },
};
