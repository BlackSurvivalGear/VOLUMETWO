const PRO_CONFIG = { PRICE_PENCE: 1999, CURRENCY: 'GBP', FIREBASE_PROJECT_ID: 'volumetwo-91bb0' };

function handleProAction_(action, params) {
  if (action === 'pro-pay') return startProCheckout_(params || {});
  if (action === 'pro-return') return finishProCheckout_(params || {});
  if (action === 'pro-cancel') return redirectPage_(CONFIG.SITE_URL + 'upgrade.html?upgrade=cancelled', 'Payment cancelled');
  return null;
}

function startProCheckout_(params) {
  const uid = clean_(params.uid), email = clean_(params.email).toLowerCase();
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(uid)) throw new Error('A valid signed-in account is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid account email is required.');
  const user = firestoreUser_(uid);
  const storedEmail = firestoreString_(user, 'email').toLowerCase();
  if (!storedEmail || storedEmail !== email) throw new Error('The signed-in account could not be verified.');
  if (firestoreString_(user, 'plan') === 'pro') return redirectPage_(CONFIG.SITE_URL + 'business-tools.html?pro=active', 'Pro already active');

  const webAppUrl = ScriptApp.getService().getUrl();
  const session = stripeRequest_('/v1/checkout/sessions', 'post', {
    mode:'payment', customer_email:email, client_reference_id:uid,
    success_url:webAppUrl+'?action=pro-return&session_id={CHECKOUT_SESSION_ID}',
    cancel_url:webAppUrl+'?action=pro-cancel',
    'metadata[uid]':uid, 'metadata[purpose]':'v2_lifetime_pro',
    'line_items[0][quantity]':'1',
    'line_items[0][price_data][currency]':PRO_CONFIG.CURRENCY.toLowerCase(),
    'line_items[0][price_data][unit_amount]':String(PRO_CONFIG.PRICE_PENCE),
    'line_items[0][price_data][product_data][name]':'Volume Two Pro — Lifetime Access',
    'line_items[0][price_data][product_data][description]':'Lifetime access to the current V2 Pro Business Tools'
  });
  if (!session.id || !session.url) throw new Error('Stripe did not create a checkout session.');
  PropertiesService.getScriptProperties().setProperty('PRO_SESSION_'+session.id, JSON.stringify({uid:uid,email:email,status:'CREATED',createdAt:Date.now()}));
  return redirectPage_(session.url, 'Opening secure Pro payment');
}

function finishProCheckout_(params) {
  const sessionId = clean_(params.session_id);
  const props = PropertiesService.getScriptProperties(), key = 'PRO_SESSION_'+sessionId;
  const pending = JSON.parse(props.getProperty(key) || '{}');
  if (!sessionId || !pending.uid || !pending.email) throw new Error('Unknown or expired Pro payment session.');
  const session = stripeRequest_('/v1/checkout/sessions/'+encodeURIComponent(sessionId), 'get');
  if (session.payment_status !== 'paid') throw new Error('Payment has not completed.');
  if (Number(session.amount_total) !== PRO_CONFIG.PRICE_PENCE) throw new Error('Pro payment amount verification failed.');
  if (String(session.currency || '').toUpperCase() !== PRO_CONFIG.CURRENCY) throw new Error('Pro payment currency verification failed.');
  if (String(session.client_reference_id || '') !== pending.uid) throw new Error('Pro payment account verification failed.');
  if (String((session.customer_details && session.customer_details.email) || session.customer_email || '').toLowerCase() !== pending.email) throw new Error('Pro payment email verification failed.');
  if (!session.metadata || session.metadata.purpose !== 'v2_lifetime_pro' || session.metadata.uid !== pending.uid) throw new Error('Pro payment metadata verification failed.');

  const user = firestoreUser_(pending.uid);
  if (firestoreString_(user, 'email').toLowerCase() !== pending.email) throw new Error('Account no longer matches this payment.');
  grantLifetimePro_(pending.uid, sessionId);
  pending.status='COMPLETED'; pending.paidAt=Date.now();
  props.setProperty(key, JSON.stringify(pending));
  return redirectPage_(CONFIG.SITE_URL + 'business-tools.html?pro=success', 'Lifetime Pro activated');
}

function firestoreUser_(uid) {
  const url='https://firestore.googleapis.com/v1/projects/'+PRO_CONFIG.FIREBASE_PROJECT_ID+'/databases/(default)/documents/users/'+encodeURIComponent(uid);
  const response=UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if(response.getResponseCode()!==200) throw new Error('Unable to verify the V2 account in Firestore.');
  return JSON.parse(response.getContentText()||'{}');
}

function firestoreString_(doc, field) { return doc && doc.fields && doc.fields[field] && doc.fields[field].stringValue ? String(doc.fields[field].stringValue) : ''; }

function grantLifetimePro_(uid, sessionId) {
  const base='https://firestore.googleapis.com/v1/projects/'+PRO_CONFIG.FIREBASE_PROJECT_ID+'/databases/(default)/documents/users/'+encodeURIComponent(uid);
  const query=['updateMask.fieldPaths=plan','updateMask.fieldPaths=proAccess','updateMask.fieldPaths=proPurchasedAt','updateMask.fieldPaths=proStripeSessionId','updateMask.fieldPaths=updatedAt'].join('&');
  const now=new Date().toISOString();
  const payload={fields:{plan:{stringValue:'pro'},proAccess:{stringValue:'lifetime'},proPurchasedAt:{timestampValue:now},proStripeSessionId:{stringValue:sessionId},updatedAt:{timestampValue:now}}};
  const response=UrlFetchApp.fetch(base+'?'+query,{method:'patch',contentType:'application/json',payload:JSON.stringify(payload),headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if(response.getResponseCode()>=300) throw new Error('Payment succeeded but Pro access could not be activated. Contact Volume Two with your Stripe receipt.');
}
