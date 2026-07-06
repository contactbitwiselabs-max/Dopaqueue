import { supabaseClient } from '../../shared/supabase.js';
import { showToast } from '../components/toast.js';

export function render(container) {
  container.innerHTML = `
    <div class="card login-card" style="max-width: 400px; margin: 40px auto; text-align: center;">
      <h2>Welcome to DopaQueue</h2>
      <p class="settings__hint">Please sign in to sync your queue across devices.</p>
      
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 24px;">
        <input type="email" id="emailInput" placeholder="Email" style="padding: 10px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text);" />
        <input type="password" id="passwordInput" placeholder="Password" style="padding: 10px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text);" />
        <button class="btn btn--primary" id="loginBtn">Sign In</button>
        <button class="btn" id="signupBtn">Sign Up</button>
      </div>
      <div style="margin-top: 16px;">
        <button class="btn btn--outline" id="skipBtn" style="width: 100%; border: none; text-decoration: underline;">Skip for now (Use completely offline)</button>
      </div>
    </div>
  `;

  const emailInput = container.querySelector('#emailInput');
  const passwordInput = container.querySelector('#passwordInput');
  
  container.querySelector('#skipBtn').addEventListener('click', () => {
    location.hash = '#/dashboard';
  });

  container.querySelector('#loginBtn').addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) return showToast('Please enter email and password');
    
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      showToast(error.message);
    } else {
      location.hash = '#/dashboard';
    }
  });

  container.querySelector('#signupBtn').addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) return showToast('Please enter email and password');
    
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      showToast(error.message);
    } else {
      showToast('Account created! Please sign in.');
    }
  });
}

export function destroy() {}
