'use client';

import { FormEvent, useEffect, useState } from 'react';
import AppHeader from './AppHeader';
import Toast, { type ToastState } from './Toast';
import { responseMessage, TOKEN_KEY, USER_KEY } from '@/lib/client';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (localStorage.getItem(TOKEN_KEY)) window.location.replace('/create');
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,24}$/.test(cleanUsername)) {
      setFieldError('Use 3–24 lowercase letters, numbers, dashes, or underscores.');
      return;
    }
    if (password.length < 6) {
      setFieldError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'register' && password !== confirm) {
      setFieldError('The two passwords you entered do not match.');
      return;
    }

    setFieldError('');
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${mode === 'login' ? 'signin' : 'signup'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, `${mode === 'login' ? 'Login' : 'Registration'} failed.`));

      if (mode === 'login') {
        const data = await response.json() as { token: string; username: string };
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, data.username);
        setToast({ kind: 'success', message: 'Login succeeded!' });
        window.setTimeout(() => window.location.assign('/create'), 450);
      } else {
        setToast({ kind: 'success', message: 'Registration succeeded!' });
        window.setTimeout(() => window.location.assign('/login'), 700);
      }
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <AppHeader authenticated={false} />
      <div className="auth-ambient auth-ambient-one" />
      <div className="auth-ambient auth-ambient-two" />
      <section className={`auth-card ${mode === 'register' ? 'register-card' : ''}`}>
        <div className="auth-intro">
          <span className="auth-kicker">{mode === 'login' ? 'Welcome back' : 'Join the studio'}</span>
          <h1>{mode === 'login' ? 'Sign in to create' : 'Create your account'}</h1>
          <p>
            {mode === 'login'
              ? 'Your next idea is waiting. Sign in to generate and share it.'
              : 'One account for your AI studio, uploads, and collection.'}
          </p>
        </div>

        <form className="auth-form" onSubmit={submit} noValidate>
          <label>
            <span>Username</span>
            <div className="input-with-icon">
              <span aria-hidden="true">@</span>
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="your_username"
                required
              />
            </div>
          </label>

          <label>
            <span>Password</span>
            <div className="input-with-icon">
              <span aria-hidden="true">●</span>
              <input
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                required
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          {mode === 'register' && (
            <label>
              <span>Confirm password</span>
              <div className="input-with-icon">
                <span aria-hidden="true">●</span>
                <input
                  autoComplete="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Enter it once more"
                  required
                />
              </div>
            </label>
          )}

          <p className="field-error" aria-live="polite">{fieldError}</p>
          <button className="primary-button auth-submit" type="submit" disabled={loading}>
            {loading ? <span className="button-spinner" aria-label="Working" /> : mode === 'login' ? 'Log in' : 'Register'}
          </button>
          <p className="auth-switch">
            {mode === 'login' ? 'New to Social AI?' : 'Already have an account?'}{' '}
            <a href={mode === 'login' ? '/register' : '/login'}>
              {mode === 'login' ? 'Register now' : 'Log in'}
            </a>
          </p>
        </form>
      </section>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}
