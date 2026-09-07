const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

initializeApp();

const auth = getAuth();
const REGION = 'europe-west1';
const SUPERADMIN_EMAIL = 'admin@lawal.org';
const ROLES = ['member', 'pro', 'admin', 'superadmin'];

const normaliseEmail = (email) => String(email || '').trim().toLowerCase();

async function requireSignedIn(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const user = await auth.getUser(request.auth.uid);

  // The designated superadmin is always resolved from the verified identity.
  // No client can grant itself this role.
  if (normaliseEmail(user.email) === SUPERADMIN_EMAIL) {
    if (user.customClaims?.role !== 'superadmin') {
      await auth.setCustomUserClaims(request.auth.uid, {
        ...(user.customClaims || {}),
        role: 'superadmin'
      });
    }
    return 'superadmin';
  }

  // Every newly created account receives an explicit member claim the first
  // time its role is resolved. This keeps member as the safe default while
  // making the account's role explicit for future dashboard permissions.
  const role = user.customClaims?.role;
  if (!ROLES.includes(role) || role === 'superadmin') {
    await auth.setCustomUserClaims(request.auth.uid, {
      ...(user.customClaims || {}),
      role: 'member'
    });
    return 'member';
  }

  return role;
}

async function requireAdmin(request) {
  const role = await requireSignedIn(request);
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Administrator access is required.');
  }
  return role;
}

async function getTargetRole(uid) {
  const target = await auth.getUser(uid);
  return {
    user: target,
    role: normaliseEmail(target.email) === SUPERADMIN_EMAIL
      ? 'superadmin'
      : (ROLES.includes(target.customClaims?.role) ? target.customClaims.role : 'member')
  };
}

async function assertCanManageTarget(callerRole, callerUid, targetUid) {
  if (callerUid === targetUid) {
    throw new HttpsError('failed-precondition', 'You cannot manage your own account.');
  }

  const { user, role } = await getTargetRole(targetUid);
  if (callerRole === 'admin' && role === 'superadmin') {
    throw new HttpsError('permission-denied', 'Only a superadmin can manage the superadmin account.');
  }
  return { user, role };
}

async function listAllUsers() {
  const users = [];
  let pageToken;

  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}

const serialiseUser = (user) => {
  const claims = user.customClaims || {};
  const role = normaliseEmail(user.email) === SUPERADMIN_EMAIL
    ? 'superadmin'
    : (ROLES.includes(claims.role) ? claims.role : 'member');

  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    provider: user.providerData?.map((provider) => provider.providerId).join(', ') || 'password',
    createdAt: user.metadata?.creationTime || null,
    lastSignInAt: user.metadata?.lastSignInTime || null,
    disabled: Boolean(user.disabled),
    emailVerified: Boolean(user.emailVerified),
    role
  };
};

exports.getMyRole = onCall({ region: REGION }, async (request) => {
  const role = await requireSignedIn(request);
  return { role, roles: ROLES };
});

exports.listUsers = onCall({ region: REGION }, async (request) => {
  await requireAdmin(request);
  const users = await listAllUsers();
  return { users: users.map(serialiseUser) };
});

exports.setUserDisabled = onCall({ region: REGION }, async (request) => {
  const callerRole = await requireAdmin(request);
  const uid = String(request.data?.uid || '').trim();
  const disabled = request.data?.disabled;

  if (!uid || typeof disabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'A user ID and boolean disabled value are required.');
  }

  await assertCanManageTarget(callerRole, request.auth.uid, uid);
  await auth.updateUser(uid, { disabled });
  if (disabled) await auth.revokeRefreshTokens(uid);
  return { success: true, disabled };
});

exports.deleteUser = onCall({ region: REGION }, async (request) => {
  const callerRole = await requireAdmin(request);
  const uid = String(request.data?.uid || '').trim();

  if (!uid) {
    throw new HttpsError('invalid-argument', 'A user ID is required.');
  }

  await assertCanManageTarget(callerRole, request.auth.uid, uid);
  await auth.deleteUser(uid);
  return { success: true };
});

exports.setUserRole = onCall({ region: REGION }, async (request) => {
  const callerRole = await requireAdmin(request);
  const uid = String(request.data?.uid || '').trim();
  const role = String(request.data?.role || '').trim().toLowerCase();

  if (!uid || !['member', 'pro', 'admin'].includes(role)) {
    throw new HttpsError('invalid-argument', 'A user ID and role of member, pro, or admin are required.');
  }

  if (uid === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'You cannot change your own role.');
  }

  const target = await auth.getUser(uid);
  if (normaliseEmail(target.email) === SUPERADMIN_EMAIL) {
    throw new HttpsError('failed-precondition', 'The designated superadmin role cannot be changed here.');
  }

  const currentRole = ROLES.includes(target.customClaims?.role)
    ? target.customClaims.role
    : 'member';

  // Admins may manage the member/pro access tiers, but only the superadmin
  // can grant or remove the administrator role.
  if ((role === 'admin' || currentRole === 'admin') && callerRole !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Only a superadmin can grant or remove the admin role.');
  }

  const currentClaims = { ...(target.customClaims || {}), role };
  await auth.setCustomUserClaims(uid, currentClaims);
  return { success: true, role };
});
