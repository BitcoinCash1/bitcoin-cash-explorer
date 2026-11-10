import DB from '../database';

test('terminal shutdown waits for pool closure and prevents pool recreation', async () => {
  let finish!: () => void;
  const end = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  (DB as any).pool = { end };
  let closed = false;
  const closing = DB.shutdown().then(() => {
    closed = true;
  });
  expect(end).toHaveBeenCalledTimes(1);
  await expect(DB.query('SELECT 1')).rejects.toThrow('Database is shutting down');
  expect(closed).toBe(false);
  finish();
  await closing;
  expect(closed).toBe(true);
  await expect(DB.query('SELECT 1')).rejects.toThrow('Database is shutting down');
  expect((DB as any).pool).toBeNull();
});
