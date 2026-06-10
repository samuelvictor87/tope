import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Card } from '../components/ui/Card';

interface PlaceholderPageProps {
  title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <DashboardLayout pageTitle={title}>
      <Card style={{ padding: 'var(--spacing-32)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--spacing-8)' }}>
          Módulo de {title}
        </h2>
        <p style={{ color: 'var(--color-grey-500)', fontSize: 'var(--font-size-sm)' }}>
          Este módulo está planejado no fluxo e será construído na próxima etapa, conforme a ordem de priorização de menus.
        </p>
      </Card>
    </DashboardLayout>
  );
}
