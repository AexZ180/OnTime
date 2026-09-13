const today = new Date();
function escapeText(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const profileState = OnTimeProfile.read() || {username:'',email:'',phone:''};

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
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
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
  selectedDayTitle.textContent = (sameDay(dashboardState.selectedDate,today)?'Today · ':'')+formatSelectedDate(dashboardState.selectedDate);

  if (!plans.length) {
    scheduleList.innerHTML = `
      <div class="empty-plan">
        <p>Nothing planned yet.</p>
        <span>Try adding a light moment for yourself or someone you care about.</span>
      </div>
    `;
    return;
  }

  scheduleList.innerHTML = plans.map((plan,index) => `
    <article class="schedule-item">
      <div class="schedule-time">${escapeText(plan.time)}</div>
      <div>
        <h3>${escapeText(plan.title)}</h3>
        <p>${escapeText(plan.detail)}</p><p class="plan-sharing-summary">${(plan.invitees||[]).length} invited · ${plan.visibility==='friends'?'Friends can see details':'Others see Busy'}</p><button type="button" class="sharing-link" data-index="${index}">Invites &amp; visibility</button>
      </div>
      <button type="button" class="remove-plan" data-index="${index}" aria-label="Delete ${escapeText(plan.title)}">Delete</button>
    </article>
  `).join('');
  scheduleList.querySelectorAll('.sharing-link').forEach(button=>button.onclick=()=>window.openPlanSharing(Number(button.dataset.index)));
  scheduleList.querySelectorAll('.remove-plan').forEach(button=>button.onclick=()=>askDelete(Number(button.dataset.index)));
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
    if (isSelected) classes.push('selected');
    if (getPlansFor(date).length) classes.push('has-plans');

    cells.push(`
      <button
        type="button"
        class="${classes.join(' ')}"
        data-date="${toKey(date)}"
        aria-label="${formatSelectedDate(date)}" aria-pressed="${isSelected}"
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
      renderAll();
    });
  });
}

function openProfileDialog() {
  const usernameEl = document.getElementById('profile-username');
  const emailEl = document.getElementById('profile-email');
  const passwordEl = document.getElementById('profile-password');

  usernameEl.value = profileState.username;
  emailEl.value = profileState.email;
  passwordEl.value = '';
  profileDialog.showModal();
}

function closeProfileDialog() {
  profileDialog.close();
}

function deleteAccount() {
  OnTimeProfile.clear();
  profileDialog.close();
  alert('Demo reset. No real account was changed.');
  window.location.href = 'index.html';
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
  response.textContent = 'This is a frontend preview, so I can’t process requests yet. You can try the Add plan button to place something on your calendar.';
  chatBody.appendChild(response);

  input.value = '';
  chatBody.scrollTop = chatBody.scrollHeight;
}

function bindProfileForm() {
  profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name=document.getElementById('profile-username'); if(!/^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(name.value)){name.setCustomValidity('Use 3–24 letters, numbers, or underscores, starting with a letter.');name.reportValidity();return;}name.setCustomValidity('');profileState.username=name.value;
    profileState.email = document.getElementById('profile-email').value.trim() || profileState.email;
    document.getElementById('profile-password').value = '';
    OnTimeProfile.save(profileState);updateGreeting();
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
  renderAll();
});

document.getElementById('next-month').addEventListener('click', () => {
  dashboardState.currentMonth = new Date(dashboardState.currentMonth.getFullYear(), dashboardState.currentMonth.getMonth() + 1, 1);
  renderAll();
});

profileBtn.addEventListener('click', openProfileDialog);
closeProfile.addEventListener('click', closeProfileDialog);
deleteAccountBtn.addEventListener('click', deleteAccount);
chatToggle.addEventListener('click', () => toggleChat());
closeChat.addEventListener('click', () => toggleChat(false));
document.getElementById('chat-form').addEventListener('submit', handleChatSubmit);

document.getElementById('profile-username').oninput=e=>e.target.setCustomValidity('');
bindProfileForm();
initializeCalendar();

function initializeCalendar(){
 Object.values(dashboardState.plans).flat().forEach(p=>p.type=/Coffee|Walk/.test(p.title)?'outing':'personal');
 const deadline=new Date(today.getFullYear(),today.getMonth(),today.getDate()+4);
 dashboardState.plans[toKey(deadline)]=[{title:'Project deadline',time:'5:00 PM',detail:'Finish the final review.',type:'deadline'}];
 document.getElementById('today-label').textContent=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(today);
 function clock(){document.getElementById('current-time').textContent=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date());}clock();setInterval(clock,60000);
 const move=delta=>{dashboardState.currentMonth=new Date(dashboardState.currentMonth.getFullYear(),dashboardState.currentMonth.getMonth()+delta,1);renderAll();};
 document.getElementById('large-prev').onclick=()=>move(-1);document.getElementById('large-next').onclick=()=>move(1);
 document.getElementById('today-button').onclick=()=>selectDay(toKey(today));
 const planDialog=document.getElementById('plan-dialog');
 document.getElementById('add-plan').onclick=()=>{document.getElementById('plan-form').reset();document.getElementById('plan-date').value=toKey(dashboardState.selectedDate);document.getElementById('plan-time').value='12:00';buildPlanControls();window.prepareSocialPlan?.();planDialog.showModal();};
 document.getElementById('close-plan').onclick=()=>planDialog.close();
 document.getElementById('plan-form').onsubmit=e=>{e.preventDefault();const name=document.getElementById('plan-name');if(!name.value.trim()){name.setCustomValidity('Add a name for your plan.');name.reportValidity();return;}name.setCustomValidity('');if(!syncPlanControls())return;const key=document.getElementById('plan-date').value;const clockValue=document.getElementById('plan-time').value;const date=new Date(key+'T'+clockValue);if(!Number.isFinite(+date))return;(dashboardState.plans[key]??=[]).push({title:name.value.trim(),time:new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(date),detail:document.getElementById('plan-detail').value.trim(),type:document.getElementById('plan-type').value,...window.readSocialPlan?.()});planDialog.close();selectDay(key);};
 document.getElementById('plan-name').oninput=e=>e.target.setCustomValidity('');
 renderAll();
}
function selectDay(key){const date=new Date(key+'T12:00:00');dashboardState.selectedDate=date;dashboardState.currentMonth=new Date(date.getFullYear(),date.getMonth(),1);renderAll();}
function renderAll(){updateGreeting();renderMiniCalendar();renderBigCalendar();renderSelectedPlans();renderUpcoming();}
function renderBigCalendar(){
 const month=dashboardState.currentMonth;document.getElementById('large-month-label').textContent=new Intl.DateTimeFormat('en-US',{month:'long'}).format(month);document.getElementById('large-year-label').textContent=month.getFullYear();
 const start=new Date(month.getFullYear(),month.getMonth(),1-month.getDay());
 const grid=document.getElementById('month-grid');let html='';
 for(let i=0;i<42;i++){const date=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i);const plans=getPlansFor(date);html+=`<button type="button" class="month-cell ${date.getMonth()!==month.getMonth()?'out-month':''} ${sameDay(date,today)?'today':''} ${sameDay(date,dashboardState.selectedDate)?'selected':''}" data-date="${toKey(date)}" aria-pressed="${sameDay(date,dashboardState.selectedDate)}" aria-label="${formatSelectedDate(date)}, ${date.getFullYear()}. ${plans.length} plans${plans.length?': '+escapeText(plans.map(p=>p.title).join(', ')):''}"><span class="day-number">${date.getDate()}</span>${plans.slice(0,2).map(p=>`<span class="plan-chip ${p.type}">${escapeText(p.title)}</span>`).join('')}${plans.length>2?`<span class="more-plans">+${plans.length-2} more</span>`:''}</button>`;}
 grid.innerHTML=html;grid.querySelectorAll('button').forEach(button=>button.onclick=()=>{selectDay(button.dataset.date);document.querySelector(`#month-grid [data-date="${button.dataset.date}"]`)?.focus({preventScroll:true});});
}
function renderUpcoming(){
 const upcoming=Object.entries(dashboardState.plans).filter(([date])=>date>=toKey(today)).sort(([a],[b])=>a.localeCompare(b)).flatMap(([date,plans])=>plans.map(plan=>({...plan,date})));
 for(const [id,type] of [['due-list','deadline'],['outing-list','outing']]){const items=upcoming.filter(p=>p.type===type).slice(0,3);const host=document.getElementById(id);host.innerHTML=items.length?items.map(p=>{const date=new Date(p.date+'T12:00:00');return `<button type="button" class="upcoming-item" data-date="${p.date}"><span class="upcoming-date">${date.toLocaleString('en-US',{month:'short'})}<strong>${date.getDate()}</strong></span><span class="upcoming-title">${escapeText(p.title)}<small>${escapeText(p.time)}</small></span></button>`;}).join(''):`<p class="side-empty">No upcoming ${type==='deadline'?'due dates':'outings'}.</p>`;host.querySelectorAll('button').forEach(b=>b.onclick=()=>selectDay(b.dataset.date));}
}

function updateGreeting(){document.getElementById('calendar-greeting').textContent=profileState.username?`Your calendar, ${profileState.username}.`:'Your calendar.';}
function selectControl(id,label,values,current){return `<label class="plan-select-label">${label}<select id="${id}" aria-label="${label}">${values.map(([value,text])=>`<option value="${value}" ${String(value)===String(current)?'selected':''}>${text}</option>`).join('')}</select></label>`;}
function buildPlanControls(){
 const d=dashboardState.selectedDate, range=(n,start=0)=>Array.from({length:n},(_,i)=>[i+start,String(i+start).padStart(2,'0')]);
 const months=Array.from({length:12},(_,i)=>[i+1,new Date(2026,i,1).toLocaleString('en-US',{month:'short'})]);
 document.getElementById('plan-date-controls').innerHTML='<span class="control-caption">Date</span><div class="date-select-row">'+selectControl('event-month','Month',months,d.getMonth()+1)+selectControl('event-day','Day',range(31,1),d.getDate())+selectControl('event-year','Year',range(31,Math.min(today.getFullYear()-1,d.getFullYear())),d.getFullYear())+'</div>';
 document.getElementById('plan-time-controls').innerHTML='<span class="control-caption">Time</span><div class="date-select-row">'+selectControl('event-hour','Hour',range(12,1),12)+selectControl('event-minute','Minute',range(60),0)+selectControl('event-period','AM / PM',[['AM','AM'],['PM','PM']],'PM')+'</div>';
 document.getElementById('plan-error').textContent='';
 document.querySelectorAll('#plan-date-controls select,#plan-time-controls select').forEach(el=>{el.onchange=syncPlanControls;enhanceSelect(el);});
}
function syncPlanControls(){
 const val=id=>document.getElementById(id).value,y=+val('event-year'),m=+val('event-month'),d=+val('event-day'),date=new Date(y,m-1,d);
 if(date.getMonth()!==m-1||date.getDate()!==d){document.getElementById('plan-error').textContent='Choose a valid day for this month.';return false;}
 document.getElementById('plan-error').textContent='';document.getElementById('plan-date').value=toKey(date);
 const hour=+val('event-hour')%12+(val('event-period')==='PM'?12:0);
 document.getElementById('plan-time').value=String(hour).padStart(2,'0')+':'+val('event-minute').padStart(2,'0');return true;
}
let pendingDelete=null;
function askDelete(index){pendingDelete={key:toKey(dashboardState.selectedDate),index};document.getElementById('delete-plan-name').textContent=dashboardState.plans[pendingDelete.key][index].title;document.getElementById('delete-plan-dialog').showModal();}
document.getElementById('cancel-delete').onclick=()=>document.getElementById('delete-plan-dialog').close();
document.getElementById('confirm-delete').onclick=()=>{if(pendingDelete){dashboardState.plans[pendingDelete.key].splice(pendingDelete.index,1);pendingDelete=null;renderAll();}document.getElementById('delete-plan-dialog').close();};
const suggestions=[['Live music','J. Cole · The Fall-Off Tour','September 16 · Toyota Center'],['Game night','Houston Dynamo vs. FC Cincinnati','September 19 · Shell Energy Stadium'],['A night at the theater','The Sound of Music','September 29 · Hobby Center']];
document.getElementById('discovery-events').innerHTML=suggestions.map(([kind,title,detail])=>`<a class="discovery-card" href="https://www.ticketmaster.com/discover/houston?date=thismonth" target="_blank" rel="noopener noreferrer"><span>${kind}</span><h3>${title}</h3><p>${detail}</p><strong>Explore on Ticketmaster ↗</strong></a>`).join('');

function enhanceSelect(select){
 const label=select.getAttribute('aria-label');const wrapper=document.createElement('div');wrapper.className='event-picker';select.after(wrapper);wrapper.append(select);select.hidden=true;
 const trigger=document.createElement('button');trigger.type='button';trigger.className='event-trigger';trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.textContent=select.selectedOptions[0].textContent+' ⌄';wrapper.append(trigger);
 const list=document.createElement('div');list.className='event-options';list.hidden=true;list.setAttribute('role','listbox');list.setAttribute('aria-label',label);wrapper.append(list);
 function close(){list.hidden=true;trigger.setAttribute('aria-expanded','false');}
 function open(){document.querySelectorAll('.event-picker').forEach(el=>{el.querySelector('.event-options').hidden=true;el.querySelector('.event-trigger').setAttribute('aria-expanded','false');});list.hidden=false;trigger.setAttribute('aria-expanded','true');list.querySelector('[aria-selected="true"]').focus();}
 Array.from(select.options).forEach(option=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(option.selected));b.tabIndex=-1;b.textContent=option.textContent;b.onclick=()=>{select.value=option.value;list.querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected',String(x===b)));trigger.textContent=option.textContent+' ⌄';close();trigger.focus();select.dispatchEvent(new Event('change'));};list.append(b);});
 trigger.onclick=()=>list.hidden?open():close();trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open();}};
 list.onkeydown=e=>{const items=Array.from(list.children),i=items.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();trigger.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}};
 wrapper.addEventListener('focusout',e=>{if(!wrapper.contains(e.relatedTarget))close();});
}
