import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { fmtDate, fmtDateTime, labelize } from "./format";

const BRAND = { r: 15, g: 23, b: 42 }; // slate-900
const ACCENT = { r: 59, g: 130, b: 246 }; // blue-500

function header(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Hotel IT Operations", 14, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString(), doc.internal.pageSize.getWidth() - 14, 10, { align: "right" });

  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 32);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, 14, 38);
  }
  doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.setLineWidth(0.6);
  doc.line(14, 42, doc.internal.pageSize.getWidth() - 14, 42);
  doc.setTextColor(0, 0, 0);
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} / ${pages}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
    doc.text("Confidential · Hotel IT Operations", 14, doc.internal.pageSize.getHeight() - 8);
  }
}

export interface AssetSheetInput {
  asset_tag: string;
  asset_type: string;
  status: string;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  hostname: string | null;
  ip_address: string | null;
  mac_address?: string | null;
  operating_system?: string | null;
  cpu?: string | null;
  ram?: string | null;
  storage?: string | null;
  warranty_start?: string | null;
  warranty_end: string | null;
  purchase_date?: string | null;
  purchase_cost: number | null;
  vendor?: string | null;
  notes?: string | null;
}

export async function generateAssetSheet(asset: AssetSheetInput) {
  const doc = new jsPDF();
  header(doc, "Asset Detail Sheet", asset.asset_tag);

  const qrData = await QRCode.toDataURL(asset.asset_tag, { margin: 1, width: 200 });
  doc.addImage(qrData, "PNG", doc.internal.pageSize.getWidth() - 50, 48, 36, 36);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Scan to identify", doc.internal.pageSize.getWidth() - 50, 88);

  const rows: Array<[string, string]> = [
    ["Asset Tag", asset.asset_tag],
    ["Type", labelize(asset.asset_type)],
    ["Status", labelize(asset.status)],
    ["Manufacturer", asset.manufacturer ?? "—"],
    ["Model", asset.model ?? "—"],
    ["Serial Number", asset.serial_number ?? "—"],
    ["Hostname", asset.hostname ?? "—"],
    ["IP Address", asset.ip_address ?? "—"],
    ["MAC Address", asset.mac_address ?? "—"],
    ["Operating System", asset.operating_system ?? "—"],
    ["CPU / RAM / Storage", [asset.cpu, asset.ram, asset.storage].filter(Boolean).join(" · ") || "—"],
    ["Vendor", asset.vendor ?? "—"],
    ["Purchase Date", fmtDate(asset.purchase_date)],
    ["Purchase Cost", asset.purchase_cost != null ? String(asset.purchase_cost) : "—"],
    ["Warranty Start", fmtDate(asset.warranty_start)],
    ["Warranty End", fmtDate(asset.warranty_end)],
  ];

  autoTable(doc, {
    startY: 50,
    theme: "plain",
    margin: { left: 14, right: 60 },
    body: rows,
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", textColor: [71, 85, 105], cellWidth: 45 } },
  });

  if (asset.notes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 100) + 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text("Notes", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(doc.splitTextToSize(asset.notes, 180), 14, y + 5);
  }

  footer(doc);
  doc.save(`asset-${asset.asset_tag}.pdf`);
}

export interface InventoryRow {
  asset_tag: string;
  asset_type: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  hostname: string | null;
  status: string;
  warranty_end: string | null;
}

export function generateInventoryReport(rows: InventoryRow[], subtitle?: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  header(doc, "Asset Inventory Report", subtitle ?? `${rows.length} assets`);
  autoTable(doc, {
    startY: 48,
    head: [["Tag", "Type", "Make", "Model", "Serial", "Hostname", "Status", "Warranty End"]],
    body: rows.map((r) => [r.asset_tag, labelize(r.asset_type), r.manufacturer ?? "—", r.model ?? "—", r.serial_number ?? "—", r.hostname ?? "—", labelize(r.status), fmtDate(r.warranty_end)]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
  });
  footer(doc);
  doc.save(`asset-inventory-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export interface TicketPdfInput {
  ticket_number: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  created_at: string;
  requester_name?: string | null;
  assignee_name?: string | null;
  resolution?: string | null;
  comments?: Array<{ author?: string | null; body: string; created_at: string }>;
}

export function generateTicketReport(t: TicketPdfInput) {
  const doc = new jsPDF();
  header(doc, `Ticket ${t.ticket_number}`, t.title);
  autoTable(doc, {
    startY: 48,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", textColor: [71, 85, 105], cellWidth: 40 } },
    body: [
      ["Category", t.category ?? "—"],
      ["Priority", labelize(t.priority)],
      ["Status", labelize(t.status)],
      ["Created", fmtDateTime(t.created_at)],
      ["Requester", t.requester_name ?? "—"],
      ["Assignee", t.assignee_name ?? "—"],
    ],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 100) + 8;
  if (t.description) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text("Description", 14, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(t.description, 180);
    doc.text(lines, 14, y + 5);
    y = y + 5 + lines.length * 4 + 4;
  }
  if (t.resolution) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text("Resolution", 14, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(t.resolution, 180);
    doc.text(lines, 14, y + 5);
    y = y + 5 + lines.length * 4 + 4;
  }
  if (t.comments && t.comments.length) {
    autoTable(doc, {
      startY: y,
      head: [["When", "Author", "Comment"]],
      body: t.comments.map((c) => [fmtDateTime(c.created_at), c.author ?? "—", c.body]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255 },
    });
  }
  footer(doc);
  doc.save(`ticket-${t.ticket_number}.pdf`);
}

export interface PmComplianceRow {
  title: string;
  target_type: string;
  due_date: string;
  status: string;
  assignee?: string | null;
  completed_at?: string | null;
}

export function generatePmComplianceReport(rows: PmComplianceRow[], from: string, to: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  const total = rows.length;
  const done = rows.filter((r) => r.status === "done").length;
  const overdue = rows.filter((r) => r.status === "overdue").length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  header(doc, "PM Compliance Report", `${from} → ${to} · ${done}/${total} complete (${pct}%) · ${overdue} overdue`);
  autoTable(doc, {
    startY: 48,
    head: [["Task", "Target", "Due", "Status", "Assignee", "Completed"]],
    body: rows.map((r) => [r.title, labelize(r.target_type), fmtDate(r.due_date), labelize(r.status), r.assignee ?? "—", fmtDate(r.completed_at)]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const v = String(data.cell.raw).toLowerCase();
        if (v.includes("overdue")) { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = "bold"; }
        else if (v.includes("done")) { data.cell.styles.textColor = [22, 163, 74]; }
      }
    },
  });
  footer(doc);
  doc.save(`pm-compliance-${from}-to-${to}.pdf`);
}
export interface BriefingActionRow {
  briefing?: string;
  action_number: string;
  description: string;
  department: string;
  responsible: string;
  priority: string;
  allowed: string;
  due_at: string;
  status: string;
  ticket?: string;
}

export function generateBriefingActionsReport(rows: BriefingActionRow[], subtitle?: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  header(doc, "Briefing Action Points", subtitle ?? `${rows.length} action points`);
  autoTable(doc, {
    startY: 48,
    head: [["Briefing", "Action", "Description", "Department", "Responsible", "Priority", "Allowed", "Due", "Status"]],
    body: rows.map((r) => [r.briefing ?? "—", r.action_number, r.description, r.department, r.responsible, labelize(r.priority), r.allowed, fmtDateTime(r.due_at), labelize(r.status)]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
  });
  footer(doc);
  doc.save(`briefing-action-points-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export interface BriefingPdfInput {
  briefing_number: string;
  title: string;
  briefing_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  meeting_type: string;
  organizer: string;
  participants: string[];
  departments: string[];
  general_notes: string | null;
  discussion_points: string | null;
  actions: BriefingActionRow[];
}

export function generateBriefingReport(b: BriefingPdfInput) {
  const doc = new jsPDF();
  header(doc, `Briefing ${b.briefing_number}`, b.title);
  autoTable(doc, {
    startY: 48,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", textColor: [71, 85, 105], cellWidth: 42 } },
    body: [
      ["Date", fmtDate(b.briefing_date)],
      ["Time", `${b.start_time?.slice(0, 5) ?? "—"} – ${b.end_time?.slice(0, 5) ?? "—"}`],
      ["Location", b.location ?? "—"],
      ["Meeting type", labelize(b.meeting_type)],
      ["Organizer", b.organizer],
      ["Participants", b.participants.join(", ") || "—"],
      ["Departments", b.departments.join(", ") || "—"],
    ],
  });
  let y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 100) + 8;
  const block = (heading: string, text: string) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(heading, 14, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(text, 180);
    doc.text(lines, 14, y + 5);
    y = y + 5 + lines.length * 4 + 4;
  };
  if (b.general_notes) block("General notes", b.general_notes);
  if (b.discussion_points) block("Discussion points", b.discussion_points);
  autoTable(doc, {
    startY: y,
    head: [["Action", "Description", "Dept", "Responsible", "Priority", "Due", "Status", "IT Task"]],
    body: b.actions.map((a) => [a.action_number, a.description, a.department, a.responsible, labelize(a.priority), fmtDateTime(a.due_at), labelize(a.status), a.ticket ?? "—"]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
  });
  footer(doc);
  doc.save(`briefing-${b.briefing_number}.pdf`);
}
