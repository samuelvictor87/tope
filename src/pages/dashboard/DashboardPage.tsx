import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Truck, Wrench, Users } from '@phosphor-icons/react';

export function DashboardPage() {
  return (
    <DashboardLayout pageTitle="Painel de Controle">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-24)' }}>
        {/* Welcome Section */}
        <div>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--spacing-4)' }}>
            Olá, Pedro
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)' }}>
            Bem-vindo ao novo sistema de locação TOPE. Use o menu lateral para gerenciar a frota e cadastros.
          </p>
        </div>

        {/* Mock Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--spacing-16)' }}>
          <Card style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-16)', padding: 'var(--spacing-16)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-brand-50)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={24} />
            </div>
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-grey-500)', textTransform: 'uppercase', fontWeight: 600 }}>Caminhões</span>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 'var(--spacing-2) 0 0' }}>42</h3>
            </div>
          </Card>

          <Card style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-16)', padding: 'var(--spacing-16)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-brand-50)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wrench size={24} />
            </div>
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-grey-500)', textTransform: 'uppercase', fontWeight: 600 }}>Implementos</span>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 'var(--spacing-2) 0 0' }}>18</h3>
            </div>
          </Card>

          <Card style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-16)', padding: 'var(--spacing-16)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-brand-50)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={24} />
            </div>
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-grey-500)', textTransform: 'uppercase', fontWeight: 600 }}>Clientes</span>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 'var(--spacing-2) 0 0' }}>156</h3>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
