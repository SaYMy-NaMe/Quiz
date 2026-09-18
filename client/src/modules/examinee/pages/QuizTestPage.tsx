import { useLoaderData } from 'react-router-dom';
import type { ShareLoaderData } from '@/router/share-loader';
import { WizardSteps } from '../components/WizardSteps';

/** Placeholder — the timed test runtime lands in the timer stage. */
export function Component() {
  const { quiz } = useLoaderData() as ShareLoaderData;
  return (
    <main className="page" style={{ maxWidth: 820 }}>
      <WizardSteps current={2} />
      <h1>{quiz.title}</h1>
      <p className="muted">Timed test runtime coming next.</p>
    </main>
  );
}
