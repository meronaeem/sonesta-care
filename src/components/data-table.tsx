import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useMemo, useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  accessor?: (row: T) => string | number | null | undefined;
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  searchable = true,
  emptyText = "No records yet.",
  onRowClick,
  selectable = false,
  selectedIds,
  onSelectionChange,
}: {
  rows: T[];
  columns: Column<T>[];
  searchable?: boolean;
  emptyText?: string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) =>
      columns.some((c) => {
        const v = c.accessor ? c.accessor(r) : (r as Record<string, unknown>)[c.key];
        return v != null && String(v).toLowerCase().includes(needle);
      }),
    );
  }, [rows, q, columns]);

  const sel = selectedIds ?? new Set<string>();
  const allChecked = selectable && filtered.length > 0 && filtered.every((r) => sel.has(r.id));
  const toggleAll = () => {
    if (!onSelectionChange) return;
    const next = new Set(sel);
    if (allChecked) filtered.forEach((r) => next.delete(r.id));
    else filtered.forEach((r) => next.add(r.id));
    onSelectionChange(next);
  };
  const toggleOne = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  };

  const colCount = columns.length + (selectable ? 1 : 0);

  return (
    <div className="space-y-3">
      {searchable && (
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      )}
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
              )}
              {columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-sm text-muted-foreground py-8">{emptyText}</TableCell>
              </TableRow>
            ) : filtered.map((row) => (
              <TableRow key={row.id} className={onRowClick ? "cursor-pointer" : ""} onClick={() => onRowClick?.(row)}>
                {selectable && (
                  <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={sel.has(row.id)} onCheckedChange={() => toggleOne(row.id)} aria-label="Select row" />
                  </TableCell>
                )}
                {columns.map((c) => (
                  <TableCell key={c.key}>
                    {c.render ? c.render(row) : String((c.accessor ? c.accessor(row) : (row as Record<string, unknown>)[c.key]) ?? "—")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="text-xs text-muted-foreground">{filtered.length} of {rows.length} record{rows.length === 1 ? "" : "s"}</div>
    </div>
  );
}