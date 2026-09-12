const today = new Date();
const profileState = {
  username: 'ollie_lover',
  email: 'hello@ontime.app',
  password: 'password123'
};

const dashboardState = {
  currentMonth: new Date(today.getFullYear(), today.getMonth(), 1),
  selectedDate: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
  plans: {
    [toKey(today)]: [{
      title: 'Coffee with Maya',
      time: '9:30 AM',
      detail: 'Catch up by the windows.'
    }],
    [toKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2))]: [{
      title: 'Walk with Noah',
      time: '6:15 PM',
      detail: 'Easy loop through the park.'
    }],
    [toKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6))]: [{
      title: 'Study block',
      time: '8:00 PM',
      detail: 'Quiet time for art and notes.'
    }],
    [toKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2))]: [{
      title: 'Check-in call',
      time: '4:00 PM',
      detail: 'Quick family update.'
    }]
  }
};

const monthLabel = document.getElementById('calendar-month-label');
const miniCalendar = document.getElementById('mini-calendar');
const selectedDayTitle = document.getElementById('selected-day-title');
const scheduleList = document.getElementById('schedule-list');
const profileDialog = document.getElementById('profile-dialog');
const profileForm = document.getElementById('profile-form');
const profileBtn = document.getElementById('profile-btn');
const closeProfile = document.getElementById('close-profile');
const deleteAccountBtn = document.getElementById('delete-account');
const ollieChat = document.getElementById('ollie-chat');
const chatToggle = document.getElementById('ollie-chat-toggle');
const chatWindow = document.getElementById('ollie-chat-window');
const closeChat = document.getElementById('close-chat');

function toKey(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function formatSelectedDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

function getPlansFor(date) {
  const key = toKey(date);
  return dashboardState.plans[key] || [];
}

function renderSelectedPlans() {
  const plans = getPlansFor(dashboardState.selectedDate);
  selectedDayTitle.textContent = formatSelectedDate(dashboardState.selectedDate);

  if (!plans.length) {
    scheduleList.innerHTML = `
      <div class="empty-plan">
        <p>Nothing planned yet.</p>
        <span>Try adding a light moment for yourself or someone you care about.</span>
      </div>
    `;
    return;
  }

  scheduleList.innerHTML = plans.map(plan => `
    <article class="schedule-item">
      <div class="schedule-time">${plan.time}</div>
      <div>
        <h3>${plan.title}</h3>
        <p>${plan.detail}</p>
      </div>
    </article>
  `).join('');
}

function renderMiniCalendar() {
  const monthStart = new Date(dashboardState.currentMonth.getFullYear(), dashboardState.currentMonth.getMonth(), 1);
  const firstDayIndex = monthStart.getDay();
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(1 - firstDayIndex);

  monthLabel.textContent = formatMonthLabel(dashboardState.currentMonth);

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + i);

    const isCurrentMonth = date.getMonth() === dashboardState.currentMonth.getMonth();
    const isToday = sameDay(date, today);
    const isSelected = sameDay(date, dashboardState.selectedDate);

    let classes = ['calendar-day'];
    if (isCurrentMonth) classes.push('in-month');
    else classes.push('out-month');

    if (isToday) classes.push('today');
    if (isSelected && !isToday) classes.push('selected');

    cells.push(`
      <button
        type="button"
        class="${classes.join(' ')}"
        data-date="${toKey(date)}"
        aria-label="${formatSelectedDate(date)}"
      >
        <span>${date.getDate()}</span>
      </button>
    `);
  }

  miniCalendar.innerHTML = cells.join('');

  miniCalendar.querySelectorAll('.calendar-day').forEach((button) => {
    button.addEventListener('click', () => {
      const nextDate = new Date(button.dataset.date + 'T12:00:00');
      dashboardState.selectedDate = nextDate;
      dashboardState.currentMonth = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
      renderMiniCalendar();
      renderSelectedPlans();
    });
  });
}

function openProfileDialog() {
  const usernameEl = document.getElementById('profile-username');
  const emailEl = document.getElementById('profile-email');
  const passwordEl = document.getElementById('profile-password');

  usernameEl.value = profileState.username;
  emailEl.value = profileState.email;
  passwordEl.value = profileState.password;
  profileDialog.showModal();
}

function closeProfileDialog() {
  profileDialog.close();
}

function deleteAccount() {
  profileState.username = 'guest_user';
  profileState.email = 'guest@ontime.app';
  profileState.password = '••••••••';
  profileDialog.close();
  alert('Your demo account was deleted. You can sign in again from the login screen.');
  window.location.href = 'login.html';
}

function toggleChat(forceState) {
  const isOpen = typeof forceState === 'boolean' ? forceState : chatWindow.classList.contains('hidden');
  chatWindow.classList.toggle('hidden', !isOpen);
}

function handleChatSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('chat-input');
  const message = input.value.trim();

  if (!message) return;

  const chatBody = chatWindow.querySelector('.chat-body');
  const userMessage = document.createElement('div');
  userMessage.className = 'chat-message user';
  userMessage.textContent = message;
  chatBody.appendChild(userMessage);

  const response = document.createElement('div');
  response.className = 'chat-message assistant';
  response.textContent = 'Absolutely — I can help you carve out a little more breathing room and protect your good plans.';
  chatBody.appendChild(response);

  input.value = '';
  chatBody.scrollTop = chatBody.scrollHeight;
}

function bindProfileForm() {
  profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    profileState.username = document.getElementById('profile-username').value.trim() || profileState.username;
    profileState.email = document.getElementById('profile-email').value.trim() || profileState.email;
    profileState.password = document.getElementById('profile-password').value || profileState.password;
    closeProfileDialog();
  });
}

function bindChatDrag() {
  const dragState = { dragging: false, offsetX: 0, offsetY: 0 };

  ollieChat.addEventListener('pointerdown', (event) => {
    if (event.target.closest('#ollie-chat-toggle')) {
      return;
    }

    dragState.dragging = true;
    const rect = ollieChat.getBoundingClientRect();
    dragState.offsetX = event.clientX - rect.left;
    dragState.offsetY = event.clientY - rect.top;
    ollieChat.setPointerCapture(event.pointerId);
  });

  ollieChat.addEventListener('pointermove', (event) => {
    if (!dragState.dragging) return;
    const maxX = window.innerWidth - ollieChat.offsetWidth;
    const maxY = window.innerHeight - ollieChat.offsetHeight;
    const x = Math.min(Math.max(event.clientX - dragState.offsetX, 12), maxX - 12);
    const y = Math.min(Math.max(event.clientY - dragState.offsetY, 12), maxY - 12);
    ollieChat.style.left = `${x}px`;
    ollieChat.style.top = `${y}px`;
    ollieChat.style.right = 'auto';
    ollieChat.style.bottom = 'auto';
  });

  ollieChat.addEventListener('pointerup', () => {
    dragState.dragging = false;
  });
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
closeProfile.addEventListener('click', closeProfileDialog);
deleteAccountBtn.addEventListener('click', deleteAccount);
chatToggle.addEventListener('click', () => toggleChat());
closeChat.addEventListener('click', () => toggleChat(false));
document.getElementById('chat-form').addEventListener('submit', handleChatSubmit);

bindProfileForm();
bindChatDrag();
renderMiniCalendar();
renderSelectedPlans();
