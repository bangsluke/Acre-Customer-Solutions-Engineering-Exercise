import Papa from 'papaparse';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseMortgageCsv } from '../utils/csvParser';

describe('parseMortgageCsv URL resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves relative csv paths from the current page path', async () => {
    window.history.pushState({}, '', '/embedded/dashboard/');

    const parseSpy = vi
      .spyOn(Papa as { parse: (...args: any[]) => any }, 'parse')
      .mockImplementation((...args: any[]) => {
      const config = args[1] as Papa.ParseConfig<Record<string, string>> | undefined;
      const result: Papa.ParseResult<Record<string, string>> = {
        data: [],
        errors: [],
        meta: {
          aborted: false,
          cursor: 0,
          delimiter: ',',
          linebreak: '\n',
          fields: [],
          truncated: false,
        },
      };
      config?.complete?.(result, args[0]);
      return {};
      });

    await parseMortgageCsv('./mortgage.csv', () => undefined);

    expect(parseSpy).toHaveBeenCalledWith(
      `${window.location.origin}/embedded/dashboard/mortgage.csv`,
      expect.objectContaining({
        download: true,
        header: true,
      }),
    );
  });
});
