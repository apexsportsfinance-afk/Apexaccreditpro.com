import React, { useState, useMemo, useCallback, useRef, memo } from "react";
import { ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100, 200, 500];

const tableRowVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } }
};

const TableRow = memo(function TableRow({ row, columns, selectable, selectedRows, onSelectRow, onRowClick, rowClassName }) {
  const isSelected = selectedRows.includes(row.id);

  const handleCheckboxChange = useCallback((e) => {
    e.stopPropagation();
    onSelectRow(row.id);
  }, [row.id, onSelectRow]);

  const handleRowClick = useCallback(() => {
    onRowClick?.(row);
  }, [row, onRowClick]);

  return (
    <tr
      className={cn(
        "border-b border-border bg-transparent hover:bg-base-alt/40 transition-colors duration-150 ease-out",
        onRowClick && "cursor-pointer",
        isSelected && "bg-primary-500/10 border-l-2 border-l-primary-500",
        rowClassName ? rowClassName(row) : ""
      )}
      onClick={handleRowClick}
    >
      {selectable && (
        <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            className="w-3.5 h-3.5 rounded border-border bg-base text-primary-500 focus:ring-primary-500/40"
          />
        </td>
      )}
      {columns.map((column) => {
        const accessor = column.accessor || column.key;
        const value = accessor?.split(".").reduce((obj, k) => obj?.[k], row);
        return (
          <td key={column.key || column.accessor} className={cn("px-4 py-3 text-sm text-muted font-medium transition-colors", column.className)}>
            {column.render ? column.render(value, row) : value}
          </td>
        );
      })}
    </tr>

  );
});

export default function DataTable({
  data = [],
  columns = [],
  searchable = true,
  searchFields = [],
  selectable = false,
  selectedRows = [],
  onSelectRows,
  onRowClick,
  rowClassName,
  emptyMessage = "No data available",
  className,
  isLoading = false,
  pageSize: initialPageSize = 50,
  externalSearchValue,
  onExternalSearchChange
}) {
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(initialPageSize);
  const debounceRef = useRef(null);

  // Sync internal state with external if provided
  const searchQuery = onExternalSearchChange ? (externalSearchValue || "") : internalSearchQuery;

  // APX-FIX: Reset to first page whenever the raw data source changes (external filters)
  React.useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    if (onExternalSearchChange) {
      onExternalSearchChange(val);
    } else {
      setInternalSearchQuery(val);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(val);
      setCurrentPage(1);
    }, 300);
  }, [onExternalSearchChange]);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
    setCurrentPage(1);
  }, []);

  const searchLower = useMemo(() => debouncedQuery.toLowerCase(), [debouncedQuery]);

  const filteredData = useMemo(() => {
    let result = data;

    // APX-FIX: If we are handling search externally (in the parent), 
    // we don't need to filter again here. The 'data' prop is already filtered.
    if (!onExternalSearchChange && searchLower && searchFields.length > 0) {
      result = result.filter((item) =>
        searchFields.some((field) => {
          const value = field.split(".").reduce((obj, key) => obj?.[key], item);
          return String(value || "").toLowerCase().includes(searchLower);
        })
      );
    }

    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        const getVal = (obj) => sortConfig.key.split(".").reduce((o, k) => o?.[k], obj);
        const aVal = getVal(a);
        const bVal = getVal(b);
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortConfig.direction === "asc" ? -1 : 1;
        if (bVal == null) return sortConfig.direction === "asc" ? 1 : -1;
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchLower, searchFields, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, safePage, rowsPerPage]);

  const selectedRowsSet = useMemo(() => new Set(selectedRows), [selectedRows]);
  const selectedRowsSetForChild = useMemo(() => [...selectedRowsSet], [selectedRowsSet]);

  const handleSelectAll = useCallback(() => {
    if (!onSelectRows) return;
    const pageIds = paginatedData.map((item) => item.id);
    const allPageSelected = pageIds.every((id) => selectedRowsSet.has(id));
    if (allPageSelected) {
      onSelectRows(selectedRows.filter((id) => !pageIds.includes(id)));
    } else {
      const newSelected = new Set([...selectedRows, ...pageIds]);
      onSelectRows([...newSelected]);
    }
  }, [paginatedData, selectedRows, selectedRowsSet, onSelectRows]);

  const handleSelectAllFiltered = useCallback(() => {
    if (!onSelectRows) return;
    onSelectRows(filteredData.map((item) => item.id));
  }, [filteredData, onSelectRows]);

  const handleSelectRow = useCallback((id) => {
    if (!onSelectRows) return;
    if (selectedRowsSet.has(id)) {
      onSelectRows(selectedRows.filter((rowId) => rowId !== id));
    } else {
      onSelectRows([...selectedRows, id]);
    }
  }, [selectedRows, selectedRowsSet, onSelectRows]);

  const allPageSelected = paginatedData.length > 0 && paginatedData.every((r) => selectedRowsSet.has(r.id));

  const goToPage = useCallback((page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const getPageNumbers = useCallback(() => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, safePage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [safePage, totalPages]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {searchable && (
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-4 py-2 bg-base border border-border rounded-lg text-sm text-main placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary-500/60 focus:border-primary-500 transition-all shadow-inner"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted">Rows:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-base border border-border rounded-md px-2 py-1 text-sm text-main focus:outline-none focus:ring-1 focus:ring-primary-500/60"
          >
            {ROWS_PER_PAGE_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="bg-base text-main">{opt}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/60 bg-slate-900/40 shadow-xl shadow-black/20">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 border-b border-slate-700/80">
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded border-border bg-base text-primary-500 focus:ring-primary-500/40"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key || column.accessor}
                  className={cn(
                    "px-4 py-3 text-left text-[13px] font-bold text-main tracking-widest uppercase bg-base-alt/80",
                    column.className,
                    column.sortable && "cursor-pointer select-none hover:text-primary-500 transition-colors"
                  )}
                  onClick={() => column.sortable && handleSort(column.key || column.accessor)}
                >
                  <div className="flex items-center gap-1.5">
                    {column.header}
                    {column.sortable && sortConfig.key === (column.key || column.accessor) && (
                      <div className="flex flex-col">
                        <ChevronUp className={cn("w-3 h-3 -mb-1", sortConfig.direction === "asc" ? "text-primary-500" : "text-muted/40")} />
                        <ChevronDown className={cn("w-3 h-3", sortConfig.direction === "desc" ? "text-primary-500" : "text-muted/40")} />
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">

            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse bg-base even:bg-base-alt/20">
                  {selectable && <td className="px-4 py-3"><div className="w-4 h-4 rounded bg-border"></div></td>}
                  {columns.map((c, cIdx) => (
                    <td key={cIdx} className="px-4 py-4">
                      <div className="h-4 bg-border rounded w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-10 text-center text-muted text-lg"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => (
                <TableRow
                  key={row.id}
                  row={row}
                  columns={columns}
                  selectable={selectable}
                  selectedRows={selectedRowsSetForChild}
                  onSelectRow={handleSelectRow}
                  onRowClick={onRowClick}
                  rowClassName={rowClassName}
                />
              ))
            )}
          </tbody>

        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-lg text-muted px-1">
        <div className="flex items-center gap-3">
          <span>
            {filteredData.length === 0
              ? "No entries"
              : `${(safePage - 1) * rowsPerPage + 1}-${Math.min(safePage * rowsPerPage, filteredData.length)} of ${filteredData.length}`}
            {data.length !== filteredData.length && ` (filtered from ${data.length})`}
          </span>
          {selectable && selectedRows.length > 0 && (
            <span className="text-primary-500 font-medium">{selectedRows.length} selected</span>
          )}
          {selectable && filteredData.length > 0 && selectedRows.length < filteredData.length && (
            <button
              onClick={handleSelectAllFiltered}
              className="text-lg text-primary-500 hover:text-primary-600 underline"
            >
              Select all {filteredData.length}
            </button>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage <= 1}
              className="p-1.5 rounded-md hover:bg-base-alt disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {getPageNumbers().map((page) => (
              <button
                key={page}
                onClick={() => goToPage(page)}
                className={cn(
                  "w-8 h-8 rounded-md text-lg font-medium transition-colors",
                  page === safePage
                    ? "bg-primary-500 text-white"
                    : "hover:bg-base-alt text-muted"
                )}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded-md hover:bg-base-alt disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
