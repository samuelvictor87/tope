// components/ui/DataTable.tsx — TOPE
import React from 'react';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { Pagination } from './Pagination';
import '../../styles/components/table.css';

export interface Column<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface ActionConfig<T = any> {
  icon: React.ReactNode;
  label: string;
  onClick: (row: T) => void;
  hidden?: (row: T) => boolean;
}

interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  actions?: ActionConfig<T>[];
  rowHighlight?: (row: T) => string | null;
  className?: string;
  // Props de paginação robusta embutida no rodapé
  currentPage?: number;
  totalCount?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  itemLabel?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'Nenhum dado encontrado',
  onRowClick,
  actions,
  rowHighlight,
  className = '',
  currentPage,
  totalCount,
  itemsPerPage,
  onPageChange,
  itemLabel,
}: DataTableProps<T>) {
  if (loading) {
    return <LoadingState message="Carregando dados..." />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className={`table-container ${className}`}>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{ width: col.width, textAlign: col.align || 'left' }}
                >
                  {col.label}
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th style={{ width: '120px', textAlign: 'right' }}>Ações</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => {
              const highlight = rowHighlight?.(row);
              return (
                <tr
                  key={rowIndex}
                  onClick={() => onRowClick?.(row)}
                  className={onRowClick ? 'table-row-clickable' : ''}
                  style={highlight ? { backgroundColor: highlight } : undefined}
                >
                  {columns.map(col => (
                    <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                      {col.render
                        ? col.render(row[col.key], row, rowIndex)
                        : row[col.key] ?? '—'}
                    </td>
                  ))}
                  {actions && actions.length > 0 && (
                    <td style={{ textAlign: 'right' }}>
                      <div className="table-actions">
                        {actions.map((action, i) => {
                          if (action.hidden?.(row)) return null;
                          const isDelete = action.label.toLowerCase() === 'excluir';
                          const btnClass = isDelete 
                            ? 'action-btn action-btn-delete' 
                            : 'action-btn action-btn-edit';
                          return (
                            <button
                              key={i}
                              className={btnClass}
                              onClick={e => { e.stopPropagation(); action.onClick(row); }}
                              title={action.label}
                              aria-label={action.label}
                            >
                              {action.icon}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação robusta embutida */}
      {currentPage !== undefined && totalCount !== undefined && itemsPerPage !== undefined && onPageChange && (
        <Pagination
          currentPage={currentPage}
          totalCount={totalCount}
          itemsPerPage={itemsPerPage}
          onPageChange={onPageChange}
          itemLabel={itemLabel}
        />
      )}
    </div>
  );
}
