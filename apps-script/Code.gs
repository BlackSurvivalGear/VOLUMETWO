const CONFIG = {
  CALENDAR_ID: 'primary', TIME_ZONE: 'Europe/London', SLOT_MINUTES: 30, DAYS_AHEAD: 21,
  BUSINESS_HOURS: { start: 9, end: 17 }, WEEKDAYS: [1,2,3,4,5],
  INTERNAL_EMAIL: 'info@volumetwo.co.uk', DISCOVERY_PRICE: '95.00', DISCOVERY_PRICE_PENCE: 9500,
  CURRENCY: 'GBP', SITE_URL: 'https://blacksurvivalgear.github.io/VOLUMETWO/'
};

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'availability';
    if (action === 'availability') return jsonResponse_({ok:true, slots:getAvailableSlots_()});
    if (action === 'pay') return startStripeCheckout_(e.parameter || {});
    if (action === 'stripe-return') return finishStripeCheckout_(e.parameter || {});
    if (action === 'stripe-cancel') return redirectPage_(CONFIG.SITE_URL + '?payment=cancelled', 'Payment cancelled');
    throw new Error('Unsupported action');
  } catch (err) { return jsonResponse_({ok:false, error:err.message}); }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action !== 'book') throw new Error('Unsupported action');
    return jsonResponse_({ok:true, booking:bookSlot_(body)});
  } catch (err) { return jsonResponse_({ok:false, error:err.message}); }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

function startStripeCheckout_(params) {
  const email = clean_(params.email).toLowerCase(), name = clean_(params.name);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email is required before payment.');
  const webAppUrl = ScriptApp.getService().getUrl();
  if (!webAppUrl) throw new Error('Web app URL is unavailable.');
  const session = stripeRequest_('/v1/checkout/sessions', 'post', {
    mode:'payment', customer_email:email, client_reference_id:email,
    success_url:webAppUrl+'?action=stripe-return&session_id={CHECKOUT_SESSION_ID}',
    cancel_url:webAppUrl+'?action=stripe-cancel',
    'line_items[0][quantity]':'1',
    'line_items[0][price_data][currency]':CONFIG.CURRENCY.toLowerCase(),
    'line_items[0][price_data][unit_amount]':String(CONFIG.DISCOVERY_PRICE_PENCE),
    'line_items[0][price_data][product_data][name]':'Volume Two Discovery Call',
    'line_items[0][price_data][product_data][description]':'30-minute Volume Two discovery call'
  });
  if (!session.id || !session.url) throw new Error('Stripe did not create a checkout session.');
  PropertiesService.getScriptProperties().setProperty('STRIPE_SESSION_'+session.id, JSON.stringify({email:email,name:name,status:'CREATED',createdAt:Date.now()}));
  return redirectPage_(session.url, 'Opening secure card payment');
}

function finishStripeCheckout_(params) {
  const sessionId = clean_(params.session_id);
  if (!sessionId) throw new Error('Missing Stripe checkout session ID.');
  const key='STRIPE_SESSION_'+sessionId, props=PropertiesService.getScriptProperties();
  const pending=JSON.parse(props.getProperty(key)||'{}');
  if (!pending.email) throw new Error('Unknown or expired payment session.');
  const session=stripeRequest_('/v1/checkout/sessions/'+encodeURIComponent(sessionId),'get');
  verifyStripeSession_(session,pending.email);
  pending.status='COMPLETED'; pending.paymentIntentId=clean_(session.payment_intent); pending.paidAt=Date.now();
  props.setProperty(key,JSON.stringify(pending));
  return redirectPage_(CONFIG.SITE_URL+'?payment=success&order='+encodeURIComponent(sessionId),'Payment confirmed');
}

function stripeRequest_(path, method, payload) {
  const secret=PropertiesService.getScriptProperties().getProperty('STRIPE_SECRET_KEY');
  if (!secret) throw new Error('Stripe credentials are not configured.');
  const options={method:method,headers:{Authorization:'Bearer '+secret,Accept:'application/json'},muteHttpExceptions:true};
  if (payload !== undefined) { options.payload=payload; options.contentType='application/x-www-form-urlencoded'; }
  const response=UrlFetchApp.fetch('https://api.stripe.com'+path,options);
  const body=JSON.parse(response.getContentText()||'{}');
  if (response.getResponseCode()>=300) {
    const message=body&&body.error&&body.error.message?body.error.message:response.getResponseCode();
    throw new Error('Stripe request failed: '+clean_(message));
  }
  return body;
}

function verifyStripeSession_(session,email) {
  if (!session || !session.id) throw new Error('Payment could not be verified.');
  if (session.payment_status !== 'paid') throw new Error('Payment has not completed.');
  if (Number(session.amount_total) !== CONFIG.DISCOVERY_PRICE_PENCE) throw new Error('Payment amount verification failed.');
  if (String(session.currency || '').toUpperCase() !== CONFIG.CURRENCY) throw new Error('Payment currency verification failed.');
  if (String(session.client_reference_id || '').toLowerCase() !== String(email || '').toLowerCase()) throw new Error('Payment does not match this booking email.');
}

function verifyPayment_(sessionId,email) {
  if (!sessionId) throw new Error('Payment is required before booking.');
  const key='STRIPE_SESSION_'+clean_(sessionId), props=PropertiesService.getScriptProperties(), raw=props.getProperty(key);
  if (!raw) throw new Error('Payment could not be verified.');
  const payment=JSON.parse(raw);
  if (payment.status !== 'COMPLETED') throw new Error('Payment has not completed.');
  if (String(payment.email||'').toLowerCase() !== String(email||'').toLowerCase()) throw new Error('Payment does not match this booking email.');
  if (payment.bookingId) throw new Error('This payment has already been used for a booking.');
  const session=stripeRequest_('/v1/checkout/sessions/'+encodeURIComponent(clean_(sessionId)),'get');
  verifyStripeSession_(session,email); return payment;
}

function markPaymentUsed_(sessionId,bookingId) {
  const props=PropertiesService.getScriptProperties(), key='STRIPE_SESSION_'+clean_(sessionId);
  const payment=JSON.parse(props.getProperty(key)||'{}'); payment.bookingId=bookingId; payment.usedAt=Date.now();
  props.setProperty(key,JSON.stringify(payment));
}

function getAvailableSlots_() {
  const calendar=CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)||CalendarApp.getDefaultCalendar(), now=new Date(), slots=[];
  for (let offset=0; offset<CONFIG.DAYS_AHEAD; offset++) {
    const day=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset);
    if (!CONFIG.WEEKDAYS.includes(day.getDay())) continue;
    for (let hour=CONFIG.BUSINESS_HOURS.start; hour<CONFIG.BUSINESS_HOURS.end; hour++) for (let minute=0; minute<60; minute+=CONFIG.SLOT_MINUTES) {
      const start=new Date(day.getFullYear(),day.getMonth(),day.getDate(),hour,minute,0,0), end=new Date(start.getTime()+CONFIG.SLOT_MINUTES*60000);
      if (start.getTime()<=now.getTime()+60*60000) continue;
      if (calendar.getEvents(start, end).length) continue;
      slots.push({start:start.toISOString(),end:end.toISOString(),label:Utilities.formatDate(start,CONFIG.TIME_ZONE,'EEE d MMM, HH:mm')});
      if (slots.length>=30) return slots;
    }
  }
  return slots;
}

function bookSlot_(body) {
  ['start','end','name','email','paymentOrderId'].forEach(key=>{if(!body[key]) throw new Error('Missing '+key);});
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new Error('Invalid email');
  verifyPayment_(body.paymentOrderId, body.email);
  const start=new Date(body.start), end=new Date(body.end);
  if (isNaN(start)||isNaN(end)||end<=start) throw new Error('Invalid booking time');
  if ((end-start) !== CONFIG.SLOT_MINUTES * 60000) throw new Error('Invalid slot length');
  if (start.getTime()<=Date.now()) throw new Error('This slot is no longer available');
  const localDay=Number(Utilities.formatDate(start,CONFIG.TIME_ZONE,'u')), localHour=Number(Utilities.formatDate(start,CONFIG.TIME_ZONE,'H')), localMinute=Number(Utilities.formatDate(start,CONFIG.TIME_ZONE,'m'));
  if (!CONFIG.WEEKDAYS.includes(localDay)||localHour<CONFIG.BUSINESS_HOURS.start||localHour>=CONFIG.BUSINESS_HOURS.end||localMinute%CONFIG.SLOT_MINUTES!==0) throw new Error('Invalid booking window');
  const calendar=CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)||CalendarApp.getDefaultCalendar();
  if (calendar.getEvents(start, end).length) throw new Error('This slot has just been booked. Please choose another time.');
  const bookingId='V2-'+Utilities.getUuid().slice(0,8).toUpperCase();
  const description=['Volume Two Discovery Call','Booking ID: '+bookingId,'Stripe session: '+clean_(body.paymentOrderId),'Name: '+clean_(body.name),'Business: '+clean_(body.business),'Email: '+clean_(body.email),'Phone: '+clean_(body.phone),'Website: '+clean_(body.website),'Challenge: '+clean_(body.challenge),'Help wanted: '+clean_(body.help),'Customer/service value: '+clean_(body.value),'Urgency: '+clean_(body.urgency)].join('\n');
  const event=calendar.createEvent('Volume Two Discovery Call — '+clean_(body.business||body.name),start,end,{description:description,guests:body.email,sendInvites:true});
  markPaymentUsed_(body.paymentOrderId,bookingId);
  const when=Utilities.formatDate(start,CONFIG.TIME_ZONE,'EEEE d MMMM yyyy, HH:mm');
  MailApp.sendEmail(body.email,'Your Volume Two discovery call is booked — '+bookingId,'Hi '+clean_(body.name)+',\n\nYour Volume Two discovery call is booked for '+when+' (UK time).\n\nBooking ID: '+bookingId+'\nPayment: £95.00 paid securely by card via Stripe\n\nA calendar invitation has also been sent to you.\n\nVolume Two');
  if (CONFIG.INTERNAL_EMAIL) MailApp.sendEmail(CONFIG.INTERNAL_EMAIL,'New paid discovery call — '+bookingId,description+'\n\nTime: '+when+'\nPayment: £95.00 GBP verified via Stripe');
  return {id:bookingId,eventId:event.getId(),start:start.toISOString(),end:end.toISOString(),label:when};
}

function redirectPage_(url,title) {
  const safeUrl=escapeHtml_(url), safeTitle=escapeHtml_(clean_(title));
  const html='<!doctype html><html><head><base target="_top"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+safeTitle+'</title><style>body{font-family:Arial,sans-serif;background:#f7f7f7;color:#111;margin:0;display:grid;place-items:center;min-height:100vh}.card{background:#fff;padding:32px;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.12);max-width:420px;text-align:center}.btn{display:inline-block;margin-top:18px;padding:14px 22px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:700}</style></head><body><main class="card"><h1>'+safeTitle+'</h1><p>Continue to the secure payment page.</p><a class="btn" href="'+safeUrl+'" target="_top" rel="noopener">Continue securely</a></main></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(clean_(title));
}

function escapeHtml_(value) { return String(value||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function clean_(value) { return String(value||'').replace(/[<>]/g,'').trim().slice(0,500); }
function jsonResponse_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
