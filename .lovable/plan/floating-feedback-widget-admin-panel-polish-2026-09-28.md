# Floating Feedback Widget + Admin Panel Polish

Most of the admin page and CSV export already exist. This round swaps the feedback pop-up for a floating chat bubble and fills in the small gaps.

## What changes
1. **Floating chat bubble (bottom-right)**
   - Round frosted green button with a chat icon, sitting above the phone player bar (`fixed bottom-32 md:bottom-8 right-4 md:right-8 z-[60]`, `w-14 h-14`, grows slightly on hover).
   - Tap opens a small chat-style panel just above it (320px wide, heavy blur, see-through border): Name, Category dropdown (Bug / Request / Feedback), Message, Send.
   - The panel looks right in all three themes: dark glass in Standard/Liquid Dark, light glass with dark text in Liquid Light.
   - Send saves the message, shows a "Thanks" toast and closes the panel. Tapping the bubble again or pressing Escape also closes it.
   - The old Feedback buttons in the sidebar and top bar are removed. The bubble takes their place.
   - The bubble is hidden on the admin page.
2. **Admin page**
   - Adds the **Status** column to the table.
   - Sign Out stays at the top right, next to Refresh and Export to CSV.
   - Access check: if the `admins` list exists on your database, only people on it can see submissions (same as now). If it doesn't exist, the page relies on your database rules and shows whatever they allow. That way it works however you set up the tables.
3. **CSV export**: no changes. It already downloads `audifiya_leads.csv` with Status included.

## Technical details
- Rewrite `src/components/FeedbackModal.tsx` as a `FeedbackWidget` (FAB + popover, native `<select>`, zod validation, insert without `.select()`). Mount it once in `__root.tsx` AppLayout, hidden when pathname is `/audifiya-admin-panel`.
- Remove `FeedbackButton` usages from `Sidebar.tsx` and `AppShell.tsx`.
- `audifiya-admin-panel.tsx`: add a Status `<th>/<td>`. If the `admins` query returns an error (missing table), treat the user as allowed and query `user_submissions` directly. RLS stays the real gate.
- No SQL changes.
