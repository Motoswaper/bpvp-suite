import { ReactNode } from "react";

export function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <table className="w-full text-left text-sm text-bpvp-ink">
      <thead>
        <tr className="border-b border-bpvp-border">
          {headers.map((h) => (
            <th key={h} className="pb-2 pr-4 font-medium text-bpvp-muted">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-bpvp-border/80">
            {row.map((cell, j) => (
              <td key={j} className="py-2 pr-4">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
