import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2 } from "lucide-react";

export interface BulkField {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export function BulkEditBar({
  count,
  fields,
  onApply,
  onClear,
  pending,
  extra,
}: {
  count: number;
  fields: BulkField[];
  onApply: (updates: Record<string, string>) => void;
  onClear: () => void;
  pending?: boolean;
  extra?: ReactNode;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  if (count === 0) return null;
  const apply = () => {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) if (v) clean[k] = v;
    if (Object.keys(clean).length === 0) return;
    onApply(clean);
    setValues({});
  };
  return (
    <div className="flex items-center gap-2 flex-wrap p-3 rounded-md border bg-accent/40">
      <div className="text-sm font-medium">{count} selected</div>
      <div className="flex gap-2 flex-wrap flex-1">
        {fields.map((f) => (
          <Select key={f.key} value={values[f.key] ?? ""} onValueChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder={`Set ${f.label}…`} /></SelectTrigger>
            <SelectContent>{f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        ))}
        {extra}
      </div>
      <Button size="sm" onClick={apply} disabled={pending || Object.values(values).every((v) => !v)}>
        {pending ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : null} Apply
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}><X className="h-3 w-3 mr-1" /> Clear</Button>
    </div>
  );
}