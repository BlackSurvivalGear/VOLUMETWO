const CONFIG = {
  CALENDAR_ID: 'primary',
  TIME_ZONE: 'Europe/London',
  SLOT_MINUTES: 30,
  DAYS_AHEAD: 21,
  BUSINESS_HOURS: { start: 9, end: 17 },
  WEEKDAYS: [1, 2, 3, 4, 5],
  INTERNAL_EMAIL: 'info@volumetwo.co.uk'
};

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'availability';
    if (action !== 'availability') throw new Error('Unsupported action');
    return jsonResponse_({ ok: true, slots: getAvailableSlots_() });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action !== 'book') throw new Error('Unsupported action');
    const result = bookSlot_(body);
    return jsonResponse_({ ok: true, booking: result });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function getAvailableSlots_() {
  const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID) || CalendarApp.getDefaultCalendar();
  const now = new Date();
  const slots = [];
  for (let offset = 0; offset < CONFIG.DAYS_AHEAD; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (!CONFIG.WEEKDAYS.includes(day.getDay())) continue;
    for (let hour = CONFIG.BUSINESS_HOURS.start; hour < CONFIG.BUSINESS_HOURS.end; hour++) {
      for (let minute = 0; minute < 60; minute += CONFIG.SLOT_MINUTES) {
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
        const end = new Date(start.getTime() + CONFIG.SLOT_MINUTES * 60000);
        if (start.getTime() <= now.getTime() + 60 * 60000) continue;
        if (calendar.getEvents(start, end).length) continue;
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          label: Utilities.formatDate(start, CONFIG.TIME_ZONE, 'EEE d MMM, HH:mm')
        });
        if (slots.length >= 30) return slots;
      }
    }
  }
  return slots;
}

function bookSlot_(body) {
  const required = ['start', 'end', 'name', 'email'];
  required.forEach((key) => { if (!body[key]) throw new Error('Missing ' + key); });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new Error('Invalid email');

  const start = new Date(body.start);
  const end = new Date(body.end);
  if (isNaN(start) || isNaN(end) || end <= start) throw new Error('Invalid booking time');
  if ((end - start) !== CONFIG.SLOT_MINUTES * 60000) throw new Error('Invalid slot length');
  if (start.getTime() <= Date.now()) throw new Error('This slot is no longer available');

  const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID) || CalendarApp.getDefaultCalendar();
  if (calendar.getEvents(start, end).length) throw new Error('This slot has just been booked. Please choose another time.');

  const bookingId = 'V2-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  const description = [
    'Volume Two Discovery Call',
    'Booking ID: ' + bookingId,
    'Name: ' + clean_(body.name),
    'Business: ' + clean_(body.business),
    'Email: ' + clean_(body.email),
    'Phone: ' + clean_(body.phone),
    'Website: ' + clean_(body.website),
    'Challenge: ' + clean_(body.challenge),
    'Help wanted: ' + clean_(body.help),
    'Customer/service value: ' + clean_(body.value),
    'Urgency: ' + clean_(body.urgency)
  ].join('\n');

  const event = calendar.createEvent(
    'Volume Two Discovery Call — ' + clean_(body.business || body.name),
    start,
    end,
    { description: description, guests: body.email, sendInvites: true }
  );

  const when = Utilities.formatDate(start, CONFIG.TIME_ZONE, 'EEEE d MMMM yyyy, HH:mm');
  const subject = 'Your Volume Two discovery call is booked — ' + bookingId;
  const message = 'Hi ' + clean_(body.name) + ',\n\nYour Volume Two discovery call is booked for ' + when + ' (UK time).\n\nBooking ID: ' + bookingId + '\n\nA calendar invitation has also been sent to you.\n\nVolume Two';
  MailApp.sendEmail(body.email, subject, message);
  if (CONFIG.INTERNAL_EMAIL) MailApp.sendEmail(CONFIG.INTERNAL_EMAIL, 'New discovery call — ' + bookingId, description + '\n\nTime: ' + when);

  return { id: bookingId, eventId: event.getId(), start: start.toISOString(), end: end.toISOString(), label: when };
}

function clean_(value) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, 500);
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
