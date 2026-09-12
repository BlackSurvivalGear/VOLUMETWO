# Volume Two Discovery Calendar backend

This Apps Script web app is the secure server-side bridge between the public Volume Two site and Google Calendar.

## Deploy
1. Open script.google.com while signed into the Google Workspace account that owns the Volume Two booking calendar.
2. Create a new Apps Script project and paste `Code.gs` into it.
3. Review `CONFIG`. The default calendar is `primary`, timezone is `Europe/London`, calls are 30 minutes, Monday-Friday, 09:00-17:00, up to 21 days ahead.
4. Deploy > New deployment > Web app.
5. Execute as: Me.
6. Who has access: Anyone.
7. Authorize Calendar and Mail permissions.
8. Copy the `/exec` deployment URL.
9. In `script.js`, replace `PASTE_APPS_SCRIPT_WEB_APP_URL_HERE` with that `/exec` URL in the `CALENDAR_API_URL` constant.
10. Commit that URL on the booking branch and verify availability and a test booking before merging.

## Endpoints
`GET <web-app-url>?action=availability` returns currently free slots.

`POST <web-app-url>` with `{ action: "book", ...leadData }` rechecks the selected slot under a script lock, creates the event, sends the attendee invite and sends confirmation/internal emails.

The backend rechecks Calendar immediately before creating the event. This is the double-booking safeguard; the browser's slot list is never trusted as final availability.
