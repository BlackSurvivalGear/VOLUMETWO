import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);
const form = document.querySelector('#room-post-form');
const feed = document.querySelector('#room-feed');
const status = document.querySelector('#room-post-status');
const filterButtons = document.querySelectorAll('[data-room-filter]');
let currentUser = null;
let posts = [];
let activeFilter = 'all';

const escapeHtml = (value = '') => value.replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
const setStatus = (message, type = '') => { if (!status) return; status.textContent = message; status.dataset.type = type; };
const formatDate = (timestamp) => timestamp?.toDate ? timestamp.toDate().toLocaleString('en-GB', { dateStyle:'medium', timeStyle:'short' }) : 'Just now';

function renderPosts() {
  if (!feed) return;
  const visible = activeFilter === 'all' ? posts : posts.filter((post) => post.type === activeFilter);
  if (!visible.length) { feed.innerHTML = '<div class="room-empty">No posts here yet. Start the conversation.</div>'; return; }
  feed.innerHTML = visible.map((post) => {
    const mine = currentUser && post.authorUid === currentUser.uid;
    const label = post.type === 'question' ? 'Ask the Room' : 'Noticeboard';
    return `<article class="room-post"><div class="room-post-meta"><span>${label}</span><time>${formatDate(post.createdAt)}</time></div><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.body).replace(/\n/g,'<br>')}</p><div class="room-post-author"><strong>${escapeHtml(post.authorName || 'V2 Member')}</strong>${mine ? `<button type="button" data-delete-post="${post.id}">Delete</button>` : ''}</div></article>`;
  }).join('');
  feed.querySelectorAll('[data-delete-post]').forEach((button) => button.addEventListener('click', async () => {
    if (!currentUser || !window.confirm('Delete this post?')) return;
    button.disabled = true;
    try { await deleteDoc(doc(db, 'communityPosts', button.dataset.deletePost)); }
    catch (error) { console.error(error); setStatus('Unable to delete the post.', 'error'); button.disabled = false; }
  }));
}

filterButtons.forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.roomFilter;
  filterButtons.forEach((item) => item.classList.toggle('active', item === button));
  renderPosts();
}));

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) return;
  const postsQuery = query(collection(db, 'communityPosts'), orderBy('createdAt', 'desc'));
  onSnapshot(postsQuery, (snapshot) => { posts = snapshot.docs.map((item) => ({ id:item.id, ...item.data() })); renderPosts(); }, (error) => { console.error(error); if (feed) feed.innerHTML = '<div class="room-empty">The community feed could not be loaded.</div>'; });
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const type = form.elements.type.value;
  const title = form.elements.title.value.trim();
  const body = form.elements.body.value.trim();
  if (!['notice','question'].includes(type) || title.length < 3 || body.length < 5) { setStatus('Add a title and enough detail for other members to respond.', 'error'); return; }
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true; setStatus('Posting…');
  try {
    await addDoc(collection(db, 'communityPosts'), { type, title: title.slice(0,120), body: body.slice(0,2000), authorUid: currentUser.uid, authorName: currentUser.displayName || 'V2 Member', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    form.reset(); setStatus('Posted to The V2 Room.', 'success');
  } catch (error) { console.error(error); setStatus('Unable to publish the post.', 'error'); }
  finally { submit.disabled = false; }
});