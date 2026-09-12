const screen = document.getElementById('screen');
const dialog = document.getElementById('info-dialog');
const state = {
    step: 1,
    username: '',
    email: '',
    dob: '',
    gender: '',
    checks: {}
};
// Preview only: credentials and profile details are never sent or persisted.
const usernamePattern = /^[A-Za-z][A-Za-z0-9_]{2,23}$/;
const hasDisallowed = s => /\s|\p{Extended_Pictographic}|[\u200D\uFE0F\u20E3]/u.test(s);
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));
function field(id, label, type='text', placeholder='', value='', hint='', attrs='') {
    return `<div class="field"><label for="${id}">${label}</label><div class="input-wrap"><input id="${id}" name="${id}" type="${type}" placeholder="${placeholder}" value="${escapeHtml(value)}" aria-describedby="${id}-hint ${id}-error" ${attrs}>${type === 'password' ? `<button class="reveal" type="button" data-reveal="${id}" aria-label="Show password">Show</button>` : ''}</div><p class="hint" id="${id}-hint">${hint}</p><p class="error" id="${id}-error" aria-live="polite"></p></div>`;
}
function err(id, message) {
    const input = document.getElementById(id === 'gender' ? 'gender-trigger' : id);
    input?.setAttribute('aria-invalid', message ? 'true' : 'false');
    const target = document.getElementById(id + '-error');
    if (target)
        target.textContent = message;
    return !message;
}
function openInfo(title, html) {
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-content').innerHTML = html;
    dialog.showModal();
}
document.querySelector('.dialog-close').onclick = () => dialog.close();
document.getElementById('dialog-done').onclick = () => dialog.close();
dialog.addEventListener('click', e => {
    if (e.target === dialog && e.clientX < dialog.getBoundingClientRect().left)
        dialog.close();
}
);
function focusHeading() {
    const h = screen.querySelector('h2');
    h?.setAttribute('tabindex', '-1');
    h?.focus({
        preventScroll: true
    });
}
function bind() {
    screen.querySelectorAll('[data-reveal]').forEach(b => b.onclick = () => {
        const i = document.getElementById(b.dataset.reveal);
        i.type = i.type === 'password' ? 'text' : 'password';
        b.textContent = i.type === 'password' ? 'Show' : 'Hide';
        b.setAttribute('aria-label', `${b.textContent} password`);
    }
    );
    screen.querySelectorAll('input,select').forEach(i => i.addEventListener('input', () => {
        err(i.id, '');
        if (i.id === 'terms' && i.checked) {
            const notice = document.getElementById('checks-error');
            if (notice)
                notice.textContent = '';
        }
    }
    ));
}
function login() {
    screen.innerHTML = `<span class="section-tag">YOUR PEOPLE. YOUR PLANS.</span><h2>Welcome back.</h2><p class="subtitle">A little planning. A lot more together.</p><button class="google" type="button" id="google"><span class="google-g" aria-hidden="true">G</span>Continue with Google</button><div class="divider">or sign in with your details</div><form id="login" novalidate>${field('identity', 'Email, username, or phone number', 'text', 'you@example.com', '', '', 'autocomplete="username" maxlength="254" required')}${field('password', 'Password', 'password', 'Enter your password', '', '', 'autocomplete="current-password" maxlength="128" required')}<div class="forgot-row"><button class="text-button" id="forgot" type="button">Forgot password?</button></div><button class="primary" type="submit">Sign in</button></form><p class="switch">New around here? <a href="#signup">Create an account</a></p>`;
    document.getElementById('google').onclick = () => openInfo('Continue with Google', '<p>Google sign-in will be available once account services are connected.</p><p>New members will still choose an OnTime username and complete their profile.</p>');
    document.getElementById('forgot').onclick = () => openInfo('Reset your password', '<p>Password recovery will be available once account services are connected. No reset email is sent from this preview.</p>');
    document.getElementById('login').onsubmit = e => {
        e.preventDefault();
        const v = document.getElementById('identity').value;
        let valid = !!v && !hasDisallowed(v) && (usernamePattern.test(v) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^\+?[0-9]{7,15}$/.test(v));
        err('identity', valid ? '' : 'Enter an email, username, or phone number without spaces or emojis.');
        const pw = document.getElementById('password').value;
        err('password', pw ? '' : 'Enter your password.');
        if (valid && pw) {
            document.getElementById('password').value = '';
            openInfo('You’re in the preview', '<p>Your sign-in form is ready. Account services will be connected later, so no sign-in was attempted and your password was not saved.</p>');
        } else
            screen.querySelector('[aria-invalid="true"]')?.focus();
    }
    ;
    bind();
}
function signup() {
    const step = state.step;
    screen.innerHTML = `<div data-signup><button type="button" class="back" id="back">← ${step === 1 ? 'Back to sign in' : 'Back'}</button><div class="steps" aria-label="Step ${step} of 3">${[1, 2, 3].map(n => `<span class="${n <= step ? 'active' : ''}"></span>`).join('')}</div><span class="section-tag">STEP ${step} OF 3</span><h2>${['Make yourself at home.', 'A little about you.', 'Good to know.'][step - 1]}</h2><p class="subtitle">${['Your next good plan starts here.', 'Let’s put a person behind the plans.', 'A few things to know before we begin.'][step - 1]}</p><form id="signup" novalidate>${step === 1 ? `${field('username', 'Choose your username', 'text', 'e.g. jeimy_01', state.username, '3–24 characters. Start with a letter. Letters, numbers, and underscores only.', 'autocomplete="username" maxlength="24" required')}${field('email', 'Email address', 'email', 'you@example.com', state.email, '', 'autocomplete="email" maxlength="254" required')}${field('new-password', 'Create a password', 'password', 'At least 12 characters', '', '12–128 characters. No spaces or emojis.', 'autocomplete="new-password" minlength="12" maxlength="128" required')}` : step === 2 ? `<div class="profile-fields">${field('dob', 'Date of birth', 'date', '', state.dob, 'Choose your birthday.', 'autocomplete="bday" required')}<div class="field gender-field"><label id="gender-label" for="gender-trigger">Gender</label><input type="hidden" id="gender" name="gender" value="${escapeHtml(state.gender)}"><div class="gender-picker"><button class="select-trigger" id="gender-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="gender-options" aria-labelledby="gender-label gender-value" aria-describedby="gender-error"><span id="gender-value">${escapeHtml(state.gender) || 'Select an option'}</span><span class="chevron" aria-hidden="true"></span></button><div class="select-options" id="gender-options" role="listbox" aria-labelledby="gender-label" hidden>${['Woman', 'Man', 'Non-binary', 'Prefer not to say'].map( (g, i) => `<button type="button" role="option" data-gender="${g}" aria-selected="${state.gender === g}" tabindex="-1">${g}<span aria-hidden="true">${state.gender === g ? '✓' : ''}</span></button>`).join('')}</div></div><p class="hint">You’re always welcome to keep this private.</p><p class="error" id="gender-error" aria-live="polite"></p></div></div>` : `<div class="agreements">${[['terms', 'Terms & conditions', 'I have read and agree to the <button type="button" class="text-button" id="terms-link">Terms & Conditions</button>.'], ['recommendations', 'Event recommendations · optional', 'I’d like OnTime to suggest events I might enjoy using interests and other information I choose to share. I can change this choice later.']].map( ([id,title,copy]) => `<label class="check-row"><input id="${id}" type="checkbox" ${state.checks[id] ? 'checked' : ''}><span class="check-copy"><strong>${title}</strong>${copy}</span></label>`).join('')}</div><p class="error" id="checks-error" aria-live="polite"></p>`}<button class="primary" type="submit">${step === 3 ? 'Create account' : 'Continue'}</button></form>${step === 3 ? '<p class="small-note">Recommendations are optional and won’t affect account creation.</p>' : ''}</div>`;
    document.getElementById('back').onclick = () => {
        remember();
        if (state.step === 1)
            location.hash = 'login';
        else {
            state.step--;
            signup();
            focusHeading();
        }
    }
    ;
    if (step === 2) {
        const today = new Date();
        const local = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
        document.getElementById('dob').max = local;
        bindGender();
    }
    document.getElementById('terms-link')?.addEventListener('click', e => {
        e.preventDefault();
        openInfo('Terms & conditions', '<p><strong>Preview terms for OnTime</strong></p><h3>Planning & reminders</h3><p>You are responsible for tracking your events, deadlines, and commitments. Notifications may be delayed or unavailable. OnTime does not guarantee reminders and is not responsible for missed obligations.</p><h3>AI assistance</h3><p>OnTime was created with AI assistance. AI-powered suggestions may be inaccurate; review them before relying on them.</p><h3>Location choices</h3><p>Some features need location access while you use them. Permission will be requested separately. You can decline and continue using features that do not need location. No background location tracking is intended, and this frontend does not access your location.</p><p>These are draft acknowledgments for the frontend preview; final service terms and privacy information will be added before account registration is enabled.</p>');
    }
    );
    document.getElementById('signup').onsubmit = e => {
        e.preventDefault();
        remember();
        let valid = true;
        if (step === 1) {
            valid = err('username', usernamePattern.test(state.username) ? '' : 'Use 3–24 letters, numbers, or underscores; start with a letter.') && valid;
            valid = err('email', /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(state.email) ? '' : 'Enter a valid email without spaces or emojis.') && valid;
            const pw = document.getElementById('new-password').value;
            valid = err('new-password', pw.length >= 12 && pw.length <= 128 && !hasDisallowed(pw) ? '' : 'Use 12–128 characters without spaces or emojis.') && valid;
        }
        if (step === 2) {
            const date = new Date(state.dob + 'T12:00:00');
            const now = new Date();
            valid = err('dob', state.dob && Number.isFinite(+date) && date.getFullYear() > 0 && state.dob <= document.getElementById('dob').max ? '' : 'Choose a valid date of birth that isn’t in the future.') && valid;
            valid = err('gender', state.gender ? '' : 'Choose an option, including “Prefer not to say”.') && valid;
        }
        if (step === 3) {
            valid = !!state.checks.terms;
            document.getElementById('checks-error').textContent = valid ? '' : 'Please agree to the Terms & Conditions to continue.';
        }
        if (valid) {
            if (step < 3) {
                state.step++;
                signup();
                focusHeading();
            } else
                complete();
        } else {
            screen.querySelector('[aria-invalid="true"]')?.focus();
            if (step === 3)
                screen.querySelector('input:not(:checked)')?.focus();
        }
    }
    ;
    bind();
}
function remember() {
    for (const k of ['username', 'email', 'dob', 'gender']) {
        const i = document.getElementById(k);
        if (i)
            state[k] = i.value;
    }
    for (const k of ['terms', 'recommendations']) {
        const i = document.getElementById(k);
        if (i)
            state.checks[k] = i.checked;
    }
}
function complete() {
    screen.innerHTML = `<div class="success-icon" aria-hidden="true">✓</div><span class="section-tag">ALL SET FOR THE NEXT STEP</span><h2>Looks good, <span id="chosen-name"></span>.</h2><p class="subtitle">You’ve completed the signup preview.</p><div class="summary">No account has been created, and your details haven’t been saved. Your team can connect this flow to account services next.</div><button class="primary" id="finish">Back to sign in</button>`;
    document.getElementById('chosen-name').textContent = state.username;
    document.getElementById('finish').onclick = () => {
        state.step = 1;
        state.username = '';
        state.email = '';
        state.dob = '';
        state.gender = '';
        state.checks = {};
        location.hash = 'login';
    }
    ;
    focusHeading();
}
function route() {
    if (location.hash === '#signup')
        signup();
    else
        login();
}
function bindGender() {
    const trigger = document.getElementById('gender-trigger')
      , list = document.getElementById('gender-options');
    const options = [...list.querySelectorAll('[role="option"]')];
    const close = (focus=false) => {
        list.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (focus)
            trigger.focus();
    }
    ;
    const open = () => {
        list.classList.remove('above');
        list.hidden = false;
        if (list.getBoundingClientRect().bottom > document.querySelector('.auth-card').getBoundingClientRect().bottom - 12)
            list.classList.add('above');
        trigger.setAttribute('aria-expanded', 'true');
        (options.find(o => o.getAttribute('aria-selected') === 'true') || options[0]).focus();
    }
    ;
    trigger.onclick = () => list.hidden ? open() : close();
    trigger.onkeydown = e => {
        if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            open();
        }
    }
    ;
    options.forEach( (option, index) => {
        option.onclick = () => {
            state.gender = option.dataset.gender;
            document.getElementById('gender').value = state.gender;
            document.getElementById('gender-value').textContent = state.gender;
            options.forEach(o => {
                const chosen = o === option;
                o.setAttribute('aria-selected', String(chosen));
                o.lastElementChild.textContent = chosen ? '✓' : '';
            }
            );
            err('gender', '');
            close(true);
        }
        ;
        option.onkeydown = e => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close(true);
            }
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                e.preventDefault();
                const next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
                options[next].focus();
            }
            if (e.key === 'Tab')
                close();
        }
        ;
    }
    );
    document.querySelector('.gender-picker').addEventListener('focusout', e => {
        if (!e.currentTarget.contains(e.relatedTarget))
            close();
    }
    );
}
document.addEventListener('pointerdown', e => {
    const picker = document.querySelector('.gender-picker');
    if (picker && !picker.contains(e.target)) {
        document.getElementById('gender-options').hidden = true;
        document.getElementById('gender-trigger').setAttribute('aria-expanded', 'false');
    }
}
);
addEventListener('hashchange', () => {
    route();
    focusHeading();
}
);
route();
