// utils/templateConfig.ts — TOPE
// Mapeamento centralizado de prazo → arquivo de template + célula da comissão

export interface TemplateConfig {
  prazo: number;
  arquivo: string;        // caminho relativo a public/ (URL do fetch)
  celulaComissao: string; // célula da comissão de venda na aba "Dados"
}

const TEMPLATE_CONFIGS: TemplateConfig[] = [
  { prazo: 12,  arquivo: '/planilhas-bases/planilha-base-12m.xlsx',  celulaComissao: 'F29' },
  { prazo: 24,  arquivo: '/planilhas-bases/planilha-base-24m.xlsx',  celulaComissao: 'F29' },
  { prazo: 36,  arquivo: '/planilhas-bases/planilha-base-36m.xlsx',  celulaComissao: 'F29' },
  { prazo: 48,  arquivo: '/planilhas-bases/planilha-base-48m.xlsx',  celulaComissao: 'F29' },
  { prazo: 60,  arquivo: '/planilhas-bases/planilha-base-60m.xlsx',  celulaComissao: 'F29' },
  { prazo: 72,  arquivo: '/planilhas-bases/planilha-base-72m.xlsx',  celulaComissao: 'F30' },
  { prazo: 84,  arquivo: '/planilhas-bases/planilha-base-84m.xlsx',  celulaComissao: 'F31' },
  { prazo: 120, arquivo: '/planilhas-bases/planilha-base-120m.xlsx', celulaComissao: 'F34' },
];

/**
 * Retorna a configuração do template para o prazo dado.
 * Se não houver match exato, usa o template com prazo mais próximo.
 */
export function getTemplateConfig(prazoMeses: number): TemplateConfig {
  const exact = TEMPLATE_CONFIGS.find(c => c.prazo === prazoMeses);
  if (exact) return exact;

  // Fallback: encontrar o template com prazo mais próximo
  const sorted = [...TEMPLATE_CONFIGS].sort(
    (a, b) => Math.abs(a.prazo - prazoMeses) - Math.abs(b.prazo - prazoMeses)
  );
  return sorted[0];
}
