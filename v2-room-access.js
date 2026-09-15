import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);
const roomPages = ['/community.html', '/opportunities.html'];

if (roomPages.some((page) => window.location.pathname.endsWith(page))) {
  document.documentElement.classList.add('v2-room-access-check');

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const snapshot = await getDoc(doc(db, 'users', user.uid));
      const profile = snapshot.exists() ? snapshot.data() : {};
      const isSuperadmin = (user.email || '').toLowerCase() === 'admin@lawal.org';
      if (!isSuperadmin && profile.v2RoomAccess !== true) {
        window.location.replace('dashboard.html?room=invite-required');
        return;
      }
      document.documentElement.classList.remove('v2-room-access-check');
    } catch (error) {
      console.error('Unable to verify V2 Room invitation:', error);
      window.location.replace('dashboard.html?room=access-check-failed');
    }
  });
}
