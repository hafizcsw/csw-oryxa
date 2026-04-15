import type { RankedColumn } from "../types";

interface RankedTableProps {
  rows: any[];
  columns: RankedColumn[];
}

export function RankedTable({ rows, columns }: RankedTableProps) {
  return (
    <div className="overflow-x-auto max-h-80">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b text-muted-foreground">
            <th className="text-right p-2 w-8">#</th>
            {columns.map((col) => (
              <th key={col.key} className="text-right p-2">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-accent/30">
              <td className="p-2 text-muted-foreground text-xs">{i + 1}</td>
              {columns.map((col) => (
                <td key={col.key} className={`p-2 ${col.mono ? "font-mono text-xs" : ""} truncate max-w-[200px]`}>
                  {typeof row[col.key] === "number" ? row[col.key].toLocaleString("ar") : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
