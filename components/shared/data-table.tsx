import type { ReactNode } from 'react';

export function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) {
    return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-6 text-sm text-zinc-500">Sin registros.</div>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-zinc-800 md:block">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-black">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 text-left font-medium text-zinc-400">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-950">
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-3 text-zinc-200 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((row, index) => (
          <div key={index} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="grid gap-3">
              {row.map((cell, cellIndex) => (
                <div key={cellIndex} className="grid gap-1">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">{headers[cellIndex]}</div>
                  <div className="text-sm text-zinc-200">{cell}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
