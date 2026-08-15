# Briefing Minutes & Action Points Module

A new module to record hotel briefings/meetings and track every action point through to completion, wired into the existing Departments, Users, Help Desk, Notifications, and Activity Log.

## What gets built

### 1. Briefings
Create/edit/delete briefings with: auto Briefing ID (BRF-000123), date, start/end time, title, location, meeting type, organizer, participants, participating departments, general notes, discussion points, attachments, created by/date.

Meeting types: Daily Briefing, Management Meeting, Department Meeting, IT Meeting, Emergency Meeting, Follow-up Meeting, Other.

### 2. Action points
Each briefing holds many action points with: auto ID (AP-000123), description, related department, responsible person (user list filtered by the chosen department), priority, assigned date/time, allowed time, due date/time, status, comments, completion date, completion notes, attachments.

Allowed completion time options: 30 min, 1h, 2h, 4h, 8h, 1 day, 2 days, 3 days, 1 week, Custom. Due date/time is calculated automatically from assigned date/time + allowed time, and can be manually overridden.

Statuses: Open, In Progress, Waiting, Completed, Overdue, Cancelled. Anything still open/in progress/waiting past its deadline is flagged Overdue automatically (a scheduled job plus live display logic).

### 3. Create Task → Help Desk
A "Create Task" button on every action point opens a prefilled Help Desk ticket (description, department, responsible person as assignee, priority, due date/time, and the Briefing/Action Point IDs recorded on the ticket). The ticket links back to the action point, so you can navigate Briefing → Action Point → IT Task → Resolution in both directions. When the linked ticket is resolved/closed, you get a prompt (and an option to auto-apply) to mark the action point Completed.

### 4. Briefing details page
Professional layout: header with title, date, time, location, organizer, participants; body with general notes, discussion points, and an action points table with columns Action Point / Department / Responsible / Priority / Allowed Time / Due Date-Time / Status / IT Task / Actions. Buttons: Add Action Point, Edit, Delete, Create Task, View Task, Add Attachment, Mark Completed.

### 5. Briefing dashboard
KPI cards: Today's Briefings, Total Action Points, Open, In Progress, Completed, Overdue, Due Today, Due This Week. Charts by Department, Status, Priority, and Responsible Person.

### 6. Search and filters
Filter the briefings list and action points by date range, department, responsible person, status, priority, overdue-only, and briefing type, plus free-text search.

### 7. Alerts
Email notifications on: new action point assigned, approaching deadline, overdue, completed. Per-action-point reminder setting: 1 hour, 2 hours, or 1 day before the deadline. Reminders run on a schedule (every 15 minutes) and are logged so nothing is sent twice.

### 8. Reports
Export a single briefing (with all action points) or a filtered set to PDF and Excel, including briefing details, action points, departments, responsible persons, deadlines, and completion status. PDF matches the existing report styling.

### 9. Audit trail
Every create, edit, deadline change, status change, and completion is written to the existing Activity Log with actor and timestamp, and shown as a timeline on the briefing and action point views.

## Technical notes

- Tables: `briefings`, `briefing_participants` (user links), `briefing_departments`, `briefing_action_points`, `action_point_reminders_sent`. Enums: `briefing_type`, `action_status`, `allowed_time_option`. `tickets` gains `action_point_id` (FK) so the ticket↔action point relation is queryable both ways.
- Sequences for `BRF-` and `AP-` human IDs, `set_updated_at` triggers, and audit triggers reusing `log_activity` (entity types `briefing`, `action_point`).
- RLS: IT staff and administrators manage everything; department managers see their department's briefings/action points; employees see briefings they participate in and action points assigned to them. Explicit GRANTs on every new table.
- Overdue flip and reminders: a `pg_cron` job posting to a new `/api/public/hooks/briefing-reminders` route (anon `apikey` header, same pattern as PM reminders) that marks overdue rows and sends mail via the existing SMTP2GO helper.
- Attachments reuse the existing `attachments` panel/bucket with new entity types `briefing` and `action_point` (constraint + storage policy update).
- New routes: `/briefings` (list + filters + dashboard tab), `/briefings/$id` (details page). Sidebar entry with a notebook icon. Excel via the existing `export-xlsx` helper, PDF via `pdf-reports`.
- Responsible-person picker reads `profiles` filtered by `department_id`, with a toggle to show all users.

## Build order
1. Database migration (tables, enums, RLS, grants, triggers, ticket link column).
2. Briefings list + create/edit + details page with action points.
3. Create Task integration and two-way navigation with Help Desk.
4. Dashboard, filters, exports.
5. Reminders/notifications cron endpoint and audit timeline.
