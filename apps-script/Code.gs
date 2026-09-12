const CONFIG = {
  CALENDAR_ID: 'primary',
  TIME_ZONE: 'Europe/London',
  SLOT_MINUTES: 30,
  DAYS_AHEAD: 21,
  BUSINESS_HOURS: { start: 9, end: 17 },
  WEEKDAYS: [1, 2, 3, 4, 5],
  INTERNAL_EMAIL: 'info@volumetwo.co.uk',
  DISCOVERY_PRICE: '95.00',
  CURRENCY: 'GBP',
  SITE_URL: 'https://volumetwo.co.uk/'
};

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'availability';
    if (action === 'availability') return jsonResponse_({ ok: true, slots: getAvailableSlots_() });
    if (action === 'pay') return startPayPalCheckout_(e.parameter || {});
    if (action === 'paypal-return') return finishPayPalCheckout_(e.parameter || {});
    if (action === 'paypal-cancel') return redirectPage_(CONFIG.SITE_URL + '?payment=cancelled', 'Payment cancelled');
    throw new Error('Unsupported action');
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

function startPayPalCheckout_(params) {
  const email = clean_(params.email).toLowerCase();
  const name = clean_(params.name);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email is required before payment.');
  const webAppUrl = ScriptApp.getService().getUrl();
  if (!webAppUrl) throw new Error('Web app URL is unavailable.');
  const order = paypalRequest_('/v2/checkout/orders', 'post', {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: 'V2-DISCOVERY',
      description: 'Volume Two Discovery Call',
      custom_id: email,
      amount: { currency_code: CONFIG.CURRENCY, value: CONFIG.DISCOVERY_PRICE }
    }],
    application_context: {
      brand_name: 'Volume Two',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'PAY_NOW',
      return_url: webAppUrl + '?action=paypal-return',
      cancel_url: webAppUrl + '?action=paypal-cancel'
    }
  });
  if (!order.id) throw new Error('PayPal did not create an order.');
  PropertiesService.getScriptProperties().setProperty('PAYPAL_ORDER_' + order.id, JSON.stringify({
    email: email, name: name, status: 'CREATED', createdAt: Date.now()
  }));
  const approve = (order.links || []).find(function(link) { return link.rel === 'approve' || link.rel === 'payer-action'; });
  if (!approve || !approve.href) throw new Error('PayPal approval link was not returned.');
  return redirectPage_(approve.href, 'Opening PayPal…');
}

function finishPayPalCheckout_(params) {
  const orderId = clean_(params.token);
  if (!orderId) throw new Error('Missing PayPal order ID.');
  const key = 'PAYPAL_ORDER_' + orderId;
  const props = PropertiesService.getScriptProperties();
  const pending = JSON.parse(props.getProperty(key) || '{}');
  if (!pending.email) throw new Error('Unknown or expired payment order.');
  const capture = paypalRequest_('/v2/checkout/orders/' + encodeURIComponent(orderId) + '/capture', 'post', {});
  const unit = (capture.purchase_units || [])[0] || {};
  const payment = (((unit.payments || {}).captures || [])[0]) || {};
  const amount = payment.amount || unit.amount || {};
  if (capture.status !== 'COMPLETED' || payment.status !== 'COMPLETED') throw new Error('PayPal payment was not completed.');
  if (amount.currency_code !== CONFIG.CURRENCY || amount.value !== CONFIG.DISCOVERY_PRICE) throw new Error('Payment amount verification failed.');
  pending.status = 'COMPLETED';
  pending.captureId = payment.id || '';
  pending.paidAt = Date.now();
  props.setProperty(key, JSON.stringify(pending));
  return redirectPage_(CONFIG.SITE_URL + '?payment=success&order=' + encodeURIComponent(orderId), 'Payment confirmed');
}

function paypalRequest_(path, method, payload) {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('PAYPAL_CLIENT_ID');
  const secret = props.getProperty('PAYPAL_CLIENT_SECRET');
  const env = (props.getProperty('PAYPAL_ENVIRONMENT') || 'sandbox').toLowerCase();
  if (!clientId || !secret) throw new Error('PayPal credentials are not configured.');
  const base = env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const tokenRes = UrlFetchApp.fetch(base + '/v1/oauth2/token', {
    method: 'post',
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(clientId + ':' + secret) },
    payload: 'grant_type=client_credentials',
    contentType: 'application/x-www-form-urlencoded',
    muteHttpExceptions: true
  });
  const tokenBody = JSON.parse(tokenRes.getContentText() || '{}');
  if (tokenRes.getResponseCode() >= 300 || !tokenBody.access_token) throw new Error('PayPal authentication failed.');
  const options = {
    method: method,
    headers: { Authorization: 'Bearer ' + tokenBody.access_token, Accept: 'application/json', 'PayPal-Request-Id': Utilities.getUuid() },
    contentType: 'application/json',
    muteHttpExceptions: true
  };
  if (payload !== undefined) options.payload = JSON.stringify(payload);
  const response = UrlFetchApp.fetch(base + path, options);
  const body = JSON.parse(response.getContentText() || '{}');
  if (response.getResponseCode() >= 300) throw new Error('PayPal request failed: ' + clean_(body.message || body.name || response.getResponseCode()));
  return body;
}

function verifyPayment_(orderId, email) {
  if (!orderId) throw new Error('Payment is required before booking.');
  const raw = PropertiesService.getScriptProperties().getProperty('PAYPAL_ORDER_' + clean_(orderId));
  if (!raw) throw new Error('Payment could not be verified.');
  const payment = JSON.parse(raw);
  if (payment.status !== 'COMPLETED') throw new Error('Payment has not completed.');
  if (String(payment.email || '').toLowerCase() !== String(email || '').toLowerCase()) throw new Error('Payment does not match this booking email.');
  if (payment.bookingId) throw new Error('This payment has already been used for a booking.');
  return payment;
}

function markPaymentUsed_(orderId, bookingId) {
  const props = PropertiesService.getScriptProperties();
  const key = 'PAYPAL_ORDER_' + clean_(orderId);
  const payment = JSON.parse(props.getProperty(key) || '{}');
  payment.bookingId = bookingId;
  payment.usedAt = Date.now();
  props.setProperty(key, JSON.stringify(payment));
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
        slots.push({ start: start.toISOString(), end: end.toISOString(), label: Utilities.formatDate(start, CONFIG.TIME_ZONE, 'EEE d MMM, HH:mm') });
        if (slots.length >= 30) return slots;
      }
    }
  }
  return slots;
}

function bookSlot_(body) {
  const required = ['start', 'end', 'name', 'email', 'paymentOrderId'];
  required.forEach((key) => { if (!body[key]) throw new Error('Missing ' + key); });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new Error('Invalid email');
  verifyPayment_(body.paymentOrderId, body.email);
  const start = new Date(body.start), end = new Date(body.end);
  if (isNaN(start) || isNaN(end) || end <= start) throw new Error('Invalid booking time');
  if ((end - start) !== CONFIG.SLOT_MINUTES * 60000) throw new Error('Invalid slot length');
  if (start.getTime() <= Date.now()) throw new Error('This slot is no longer available');
  const localDay = Number(Utilities.formatDate(start, CONFIG.TIME_ZONE, 'u'));
  const localHour = Number(Utilities.formatDate(start, CONFIG.TIME_ZONE, 'H'));
  const localMinute = Number(Utilities.formatDate(start, CONFIG.TIME_ZONE, 'm'));
  if (!CONFIG.WEEKDAYS.includes(localDay) || localHour < CONFIG.BUSINESS_HOURS.start || localHour >= CONFIG.BUSINESS_HOURS.end || localMinute % CONFIG.SLOT_MINUTES !== 0) throw new Error('Invalid booking window');
  const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID) || CalendarApp.getDefaultCalendar();
  if (calendar.getEvents(start, end).length) throw new Error('This slot has just been booked. Please choose another time.');
  const bookingId = 'V2-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  const description = ['Volume Two Discovery Call','Booking ID: ' + bookingId,'PayPal order: ' + clean_(body.paymentOrderId),'Name: ' + clean_(body.name),'Business: ' + clean_(body.business),'Email: ' + clean_(body.email),'Phone: ' + clean_(body.phone),'Website: ' + clean_(body.website),'Challenge: ' + clean_(body.challenge),'Help wanted: ' + clean_(body.help),'Customer/service value: ' + clean_(body.value),'Urgency: ' + clean_(body.urgency)].join('\n');
  const event = calendar.createEvent('Volume Two Discovery Call — ' + clean_(body.business || body.name), start, end, { description: description, guests: body.email, sendInvites: true });
  markPaymentUsed_(body.paymentOrderId, bookingId);
  const when = Utilities.formatDate(start, CONFIG.TIME_ZONE, 'EEEE d MMMM yyyy, HH:mm');
  MailApp.sendEmail(body.email, 'Your Volume Two discovery call is booked — ' + bookingId, 'Hi ' + clean_(body.name) + ',\n\nYour Volume Two discovery call is booked for ' + when + ' (UK time).\n\nBooking ID: ' + bookingId + '\nPayment: £95.00 paid via PayPal\n\nA calendar invitation has also been sent to you.\n\nVolume Two');
  if (CONFIG.INTERNAL_EMAIL) MailApp.sendEmail(CONFIG.INTERNAL_EMAIL, 'New paid discovery call — ' + bookingId, description + '\n\nTime: ' + when + '\nPayment: £95.00 GBP verified');
  return { id: bookingId, eventId: event.getId(), start: start.toISOString(), end: end.toISOString(), label: when };
}

function redirectPage_(url, title) {
  const safeUrl = String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + clean_(title) + '</title></head><body><p>' + clean_(title) + '…</p><script>location.replace("' + safeUrl.replace(/&amp;/g, '&') + '")<\/script><p><a href="' + safeUrl + '">Continue</a></p></body></html>');
}
function clean_(value) { return String(value || '').replace(/[<>]/g, '').trim().slice(0, 500); }
function jsonResponse_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
