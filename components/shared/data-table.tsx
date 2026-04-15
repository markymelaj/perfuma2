import type { ReactNode } from 'react';

export function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) {
    return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-6 text-sm text-zinc-500">Sin registros.</div>;
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => (
          <div key={index} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <dl className="space-y-3">
              {row.map((cell, cellIndex) => (
                <div key={cellIndex} className="space-y-1">
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">{headers[cellIndex]}</dt>
                  <dd className="text-sm text-zinc-200">{cell}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-zinc-800 md:block">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-black">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 text-left font-medium text-zinc-400">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-950">
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-3 text-zinc-200 align-top">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
