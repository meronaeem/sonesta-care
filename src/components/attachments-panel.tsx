import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Paperclip, Upload, Trash2, Download, Loader2 } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

type EntityType = "asset" | "ticket" | "pm_task";

interface AttachmentRow {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

const MAX_BYTES = 10 * 1024 * 1024;

function fmtSize(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentsPanel({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const key = ["attachments", entityType, entityId];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments" as never)
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AttachmentRow[];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Not signed in");
      if (file.size > MAX_BYTES) throw new Error(`File is larger than 10 MB (${fmtSize(file.size)})`);
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/${entityType}/${entityId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("attachments" as never).insert({
        entity_type: entityType,
        entity_id: entityId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: user.id,
      } as never);
      if (dbErr) {
        await supabase.storage.from("attachments").remove([path]);
        throw dbErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("File uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (row: AttachmentRow) => {
      await supabase.storage.from("attachments").remove([row.storage_path]);
      const { error } = await supabase.from("attachments" as never).delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("File removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = async (row: AttachmentRow) => {
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(row.storage_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Could not create download link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    files.forEach((f) => upload.mutate(f));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4" /> Attachments <span className="text-xs text-muted-foreground">({rows.length})</span>
        </div>
        <div>
          <input ref={inputRef} type="file" multiple hidden onChange={onPick} />
          <Button size="sm" variant="outline" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
            {upload.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">Max 10 MB per file.</div>
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">No files attached yet.</div>
      ) : (
        <ul className="divide-y rounded border bg-card text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2">
              <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{r.file_name}</div>
                <div className="text-[11px] text-muted-foreground">{fmtSize(r.size_bytes)} · {fmtDateTime(r.created_at)}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => download(r)} aria-label="Download">
                <Download className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => del.mutate(r)} disabled={del.isPending} aria-label="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}