import { AuthForm } from './components/AuthForm';

export function LoginPage() {
  return (
    <main className="page page--center">
      <AuthForm mode="login" />
    </main>
  );
}

export function RegisterPage() {
  return (
    <main className="page page--center">
      <AuthForm mode="register" />
    </main>
  );
}
