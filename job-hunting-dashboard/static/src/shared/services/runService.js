export const runService = {
  startFindRun: () => fetch('/api/run?trigger=find', { method: 'POST' }),
};
