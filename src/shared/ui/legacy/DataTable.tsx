import React from 'react';

type ColumnRender<T> = {
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
};

type ColumnCell<T> = {
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
};

type ColumnAccessor = {
  header: React.ReactNode;
  accessor?: string;
  key?: string;
};

export type TableColumn<T = any> = ColumnRender<T> | ColumnCell<T> | ColumnAccessor;

type DataTableProps<T = any> = {
  columns: TableColumn<T>[];
  rows: T[];
  emptyText?: string;
  rowOnClick?: (row: T) => void;
};

const getValueAtPath = (row: any, path?: string) => {
  if (!path) return '';
  return path.split('.').reduce((current, segment) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, any>)[segment];
    }
    return undefined;
  }, row) ?? '';
};

const renderCell = (column: TableColumn, row: any) => {
  if ('render' in column && typeof column.render === 'function') {
    return column.render(row);
  }
  if ('cell' in column && typeof column.cell === 'function') {
    return column.cell(row);
  }
  const path = 'accessor' in column && column.accessor ? column.accessor : 'key' in column ? column.key : undefined;
  return getValueAtPath(row, path);
};

const columnKey = (column: TableColumn, index: number) => {
  if ('key' in column && column.key) return column.key;
  if ('accessor' in column && column.accessor) return column.accessor;
  if (typeof column.header === 'string' && column.header) return column.header;
  return `col-${index}`;
};

export default function DataTable<T = any>({
  columns,
  rows,
  emptyText,
  rowOnClick,
}: DataTableProps<T>) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-6 text-sm text-slate-500 dark:text-slate-300">
        {emptyText ?? 'No data available for selected period'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
      <table className="w-full text-sm text-left text-slate-700 dark:text-slate-200">
        <thead className="bg-slate-50 dark:bg-white/5 text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
          <tr>
            {columns.map((column, columnIndex) => (
              <th key={columnKey(column, columnIndex)} className="px-4 py-3">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`border-t border-slate-100 dark:border-white/5 ${rowOnClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5' : ''}`}
              onClick={rowOnClick ? () => rowOnClick(row) : undefined}
              data-testid="admin-order-row"
              tabIndex={rowOnClick ? 0 : undefined}
            >
              {columns.map((column, columnIndex) => (
                <td key={columnKey(column, columnIndex)} className="px-4 py-3 align-top">
                  {renderCell(column, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
