const today = new Date();
const profileState = {
  name: '',
  username: '',
  email: '',
  homeCity: '',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  locationSharing: 'never'
};

const dashboardState = {
  currentMonth: new Date(today.getFullYear(), today.getMonth(), 1),
  selectedDate: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
  events: [],
  loading: true
};

const monthLabel = document.getElementById('calendar-month-label');
const miniCalendar = document.getElementById('mini-calendar');
const selectedDayTitle = document.getElementById('selected-day-title');
const scheduleList = document.getElementById('schedule-list');
const dashboardStatus = document.getElementById('dashboard-status');
const profileDialog = document.getElementById('profile-dialog');
const profileForm = document.getElementById('profile-form');
const profileBtn = document.getElementById('profile-btn');
const closeProfile = document.getElementById('close-profile');
const ollieChat = document.getElementById('ollie-chat');
const chatToggle = document.getElementById('ollie-chat-toggle');
const chatWindow = document.getElementById('ollie-chat-window');
const closeChat = document.getElementById('close-chat');

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: options.body ? {'Content-Type': 'application/json', ...options.headers} : options.headers
    });
  } catch {
    throw new Error('OnTime is unavailable. Make sure npm run dev is still running.');
  }
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error(data.error || 'Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function localKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat('en-US', {month: 'long', year: 'numeric'}).format(date);
}

function formatSelectedDate(date) {
  return new Intl.DateTimeFormat('en-US', {weekday: 'long', month: 'long', day: 'numeric'}).format(date);
}

function eventTouchesDay(event, date) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const start = new Date(event.start);
  const end = new Date(event.end);
  return Number.isFinite(+start) && Number.isFinite(+end) && start < dayEnd && end > dayStart;
}

function getPlansFor(date) {
  return dashboardState.events
    .filter(event => eventTouchesDay(event, date))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

function eventTime(event) {
  if (event.allDay) return 'All day';
  const format = value => new Date(value).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
  return `${format(event.start)} – ${format(event.end)}`;
}

function renderSelectedPlans() {
  const plans = getPlansFor(dashboardState.selectedDate);
  selectedDayTitle.textContent = formatSelectedDate(dashboardState.selectedDate);
  scheduleList.replaceChildren();

  if (dashboardState.loading) {
    const empty = document.createElement('div');
    empty.className = 'empty-plan';
    empty.textContent = 'Loading your plans…';
    scheduleList.append(empty);
    return;
  }

  if (!plans.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-plan';
    const title = document.createElement('p');
    title.textContent = 'Nothing planned yet.';
    const detail = document.createElement('span');
    detail.textContent = 'Open the planner to make time for yourself or someone you care about.';
    empty.append(title, detail);
    scheduleList.append(empty);
    return;
  }

  plans.forEach(plan => {
    const item = document.createElement('article');
    item.className = 'schedule-item';
    const time = document.createElement('div');
    time.className = 'schedule-time';
    time.textContent = eventTime(plan);
    const copy = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = plan.title;
    const detail = document.createElement('p');
    detail.textContent = [plan.location, plan.notes, plan.attendance && `RSVP: ${plan.attendance}`].filter(Boolean).join(' · ') || 'On your calendar';
    copy.append(title, detail);
    item.append(time, copy);
    scheduleList.append(item);
  });
}

function renderMiniCalendar() {
  const monthStart = new Date(dashboardState.currentMonth.getFullYear(), dashboardState.currentMonth.getMonth(), 1);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(1 - monthStart.getDay());
  monthLabel.textContent = formatMonthLabel(dashboardState.currentMonth);
  miniCalendar.replaceChildren();

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + i);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-day ' + (date.getMonth() === dashboardState.currentMonth.getMonth() ? 'in-month' : 'out-month');
    if (sameDay(date, today)) button.classList.add('today');
    if (sameDay(date, dashboardState.selectedDate) && !sameDay(date, today)) button.classList.add('selected');
    if (getPlansFor(date).length) button.classList.add('has-plans');
    button.dataset.date = localKey(date);
    button.setAttribute('aria-label', formatSelectedDate(date));
    const number = document.createElement('span');
    number.textContent = String(date.getDate());
    button.append(number);
    button.addEventListener('click', () => {
      const nextDate = new Date(`${button.dataset.date}T12:00:00`);
      dashboardState.selectedDate = nextDate;
      dashboardState.currentMonth = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
      renderMiniCalendar();
      renderSelectedPlans();
    });
    miniCalendar.append(button);
  }
}

async function loadDashboard() {
  dashboardState.loading = true;
  dashboardStatus.textContent = '';
  renderSelectedPlans();
  try {
    const data = await api('/api/state');
    dashboardState.events = Array.isArray(data.events) ? data.events : [];
    Object.assign(profileState, {
      ...data.profile,
      name: data.profile?.name || data.user?.name || '',
      username: data.user?.username || '',
      email: data.user?.email || ''
    });
    profileBtn.textContent = (profileState.name || profileState.username || 'O')[0].toUpperCase();
    profileBtn.setAttribute('aria-label', `Open ${profileState.name || profileState.username}'s profile`);
  } catch (error) {
    if (error.status === 401) {
      location.replace('/login.html?next=' + encodeURIComponent('/dashboard.html'));
      return;
    }
    dashboardStatus.textContent = error.message;
  } finally {
    dashboardState.loading = false;
    renderMiniCalendar();
    renderSelectedPlans();
  }
}

function openProfileDialog() {
  document.getElementById('profile-name').value = profileState.name;
  document.getElementById('profile-username').value = profileState.username;
  document.getElementById('profile-email').value = profileState.email;
  document.getElementById('profile-city').value = profileState.homeCity || '';
  document.getElementById('profile-timezone').value = profileState.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  document.getElementById('profile-location').value = profileState.locationSharing || 'never';
  document.getElementById('profile-message').textContent = '';
  profileDialog.showModal();
}

async function signOut() {
  try { await api('/api/auth/logout', {method: 'POST', body: '{}'}); } catch {}
  location.replace('/login.html');
}

function toggleChat(forceState) {
  const isOpen = typeof forceState === 'boolean' ? forceState : chatWindow.classList.contains('hidden');
  chatWindow.classList.toggle('hidden', !isOpen);
}

function appendChatMessage(kind, message) {
  const chatBody = chatWindow.querySelector('.chat-body');
  const node = document.createElement('div');
  node.className = `chat-message ${kind}`;
  node.textContent = message;
  chatBody.append(node);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function ollieReply(message) {
  const lower = message.toLowerCase();
  const upcoming = dashboardState.events
    .filter(event => Date.parse(event.end) > Date.now())
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  if (/next|upcoming|plan|schedule/.test(lower)) {
    const event = upcoming[0];
    return event
      ? `Your next plan is ${event.title} on ${new Date(event.start).toLocaleString([], {weekday: 'long', hour: 'numeric', minute: '2-digit'})}.`
      : 'Your calendar is clear. Open the planner when you are ready to make a plan.';
  }
  if (/friend|people/.test(lower)) return 'Open Friends to add people and choose how much of your calendar they can see.';
  if (/poll|when|free|available/.test(lower)) return 'Open Polls or Find a time to compare availability and choose a time together.';
  if (/local|near|ticket|event/.test(lower)) return 'Open Local events to find nearby things through Ticketmaster.';
  return 'I can summarize your next plan or point you to Friends, Polls, Find a time, and Local events.';
}

function handleChatSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;
  appendChatMessage('user', message);
  appendChatMessage('assistant', ollieReply(message));
  input.value = '';
}

function bindProfileForm() {
  profileForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = profileForm.querySelector('button[type="submit"]');
    const message = document.getElementById('profile-message');
    button.disabled = true;
    message.textContent = 'Saving…';
    const update = {
      name: document.getElementById('profile-name').value.trim(),
      username: document.getElementById('profile-username').value.trim(),
      homeCity: document.getElementById('profile-city').value.trim(),
      timeZone: document.getElementById('profile-timezone').value.trim(),
      locationSharing: document.getElementById('profile-location').value
    };
    try {
      await api('/api/profile', {method: 'PATCH', body: JSON.stringify(update)});
      Object.assign(profileState, update);
      profileBtn.textContent = (profileState.name || profileState.username || 'O')[0].toUpperCase();
      message.textContent = 'Profile saved.';
      setTimeout(() => profileDialog.close(), 450);
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function bindChatDrag() {
  const dragState = {dragging: false, offsetX: 0, offsetY: 0};
  ollieChat.addEventListener('pointerdown', event => {
    if (event.target.closest('#ollie-chat-toggle') || event.target.closest('#ollie-chat-window')) return;
    dragState.dragging = true;
    const rect = ollieChat.getBoundingClientRect();
    dragState.offsetX = event.clientX - rect.left;
    dragState.offsetY = event.clientY - rect.top;
    ollieChat.setPointerCapture(event.pointerId);
  });
  ollieChat.addEventListener('pointermove', event => {
    if (!dragState.dragging) return;
    const maxX = window.innerWidth - ollieChat.offsetWidth;
    const maxY = window.innerHeight - ollieChat.offsetHeight;
    ollieChat.style.left = `${Math.min(Math.max(event.clientX - dragState.offsetX, 12), maxX - 12)}px`;
    ollieChat.style.top = `${Math.min(Math.max(event.clientY - dragState.offsetY, 12), maxY - 12)}px`;
    ollieChat.style.right = 'auto';
    ollieChat.style.bottom = 'auto';
  });
  ollieChat.addEventListener('pointerup', () => { dragState.dragging = false; });
}

document.getElementById('prev-month').addEventListener('click', () => {
  dashboardState.currentMonth = new Date(dashboardState.currentMonth.getFullYear(), dashboardState.currentMonth.getMonth() - 1, 1);
  renderMiniCalendar();
});
document.getElementById('next-month').addEventListener('click', () => {
  dashboardState.currentMonth = new Date(dashboardState.currentMonth.getFullYear(), dashboardState.currentMonth.getMonth() + 1, 1);
  renderMiniCalendar();
});
profileBtn.addEventListener('click', openProfileDialog);
closeProfile.addEventListener('click', () => profileDialog.close());
profileDialog.addEventListener('click', event => { if (event.target === profileDialog) profileDialog.close(); });
document.getElementById('sign-out').addEventListener('click', signOut);
document.getElementById('profile-sign-out').addEventListener('click', signOut);
chatToggle.addEventListener('click', () => toggleChat());
closeChat.addEventListener('click', () => toggleChat(false));
document.getElementById('chat-form').addEventListener('submit', handleChatSubmit);

bindProfileForm();
bindChatDrag();
renderMiniCalendar();
renderSelectedPlans();
loadDashboard();
