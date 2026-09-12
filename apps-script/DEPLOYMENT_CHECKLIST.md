# Production checklist

- [ ] Create Apps Script project under the intended Volume Two Google Workspace account.
- [ ] Paste `Code.gs` and, if using the manifest editor, `appsscript.json`.
- [ ] Confirm `CONFIG.CALENDAR_ID` points at the intended booking calendar. `primary` is the current default.
- [ ] Deploy as Web app: Execute as Me; access Anyone.
- [ ] Authorize Calendar and Mail scopes.
- [ ] Test `?action=availability` and confirm only genuinely free slots are returned.
- [ ] Replace `PASTE_APPS_SCRIPT_WEB_APP_URL_HERE` in `script.js` with the `/exec` URL.
- [ ] Make one test booking using a test attendee email.
- [ ] Confirm event appears on the intended calendar and blocks the slot.
- [ ] Confirm attendee invitation and confirmation email arrive.
- [ ] Confirm a second request for the same slot is rejected.
- [ ] Remove the test event.
- [ ] Merge only after these live integration checks pass.
