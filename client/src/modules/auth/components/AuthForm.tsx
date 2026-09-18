import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuthStore } from '../store/auth.store';
import { HttpError } from '@/utils/api';
import { TextField } from '@/components/TextField';

const LoginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const RegisterSchema = LoginSchema.extend({
  name: z.string().trim().min(1, 'Name is required').max(80),
  password: z.string().min(8, 'Use at least 8 characters'),
});

interface AuthFormProps {
  mode: 'login' | 'register';
}

type FieldErrors = Partial<Record<'name' | 'email' | 'password', string>>;

export function AuthForm({ mode }: AuthFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const isRegister = mode === 'register';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = (isRegister ? RegisterSchema : LoginSchema).safeParse(values);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (isRegister) await register(parsed.data as z.infer<typeof RegisterSchema>);
      else await login(parsed.data);
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const bind = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (v: string) => setValues((s) => ({ ...s, [key]: v })),
    ...(errors[key] ? { error: errors[key] } : {}),
  });

  return (
    <form className="card card--narrow" onSubmit={onSubmit} noValidate>
      <h1>{isRegister ? 'Create instructor account' : 'Instructor sign in'}</h1>
      <p className="muted">
        {isRegister ? 'Build quizzes and share them by private link.' : 'Welcome back. Sign in to manage your quizzes.'}
      </p>
      {formError && (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      )}
      {isRegister && <TextField label="Name" name="name" autoComplete="name" required {...bind('name')} />}
      <TextField label="Email" name="email" type="email" autoComplete="email" required {...bind('email')} />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        required
        {...bind('password')}
      />
      <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
        {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
      </button>
      <p className="small muted" style={{ marginTop: '1rem', textAlign: 'center' }}>
        {isRegister ? (
          <>
            Already have an account? <Link to="/login">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link to="/register">Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
