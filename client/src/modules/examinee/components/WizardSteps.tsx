interface Props {
  current: 1 | 2 | 3;
}

export function WizardSteps({ current }: Props) {
  const steps = ['Your details', 'Timed test', 'Result'] as const;
  return (
    <ol className="row" style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }} aria-label="Progress">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const cls = n === current ? 'step step--active' : n < current ? 'step step--done' : 'step';
        return (
          <li key={label} className={cls} aria-current={n === current ? 'step' : undefined}>
            <span className="step__num">{n < current ? '✓' : n}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
