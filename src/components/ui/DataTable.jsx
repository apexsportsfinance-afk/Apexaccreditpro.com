import React, { useState, useMemo, useCallback, useRef } from "react";
import { ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100, 200];

export default function DataTable({
  data = [],
  columns = [],
  searchable = true,
  searchFields = [],
  selectable = false,
  selectedRows = [],
  onSelectRows,
  onRowClick,
  emptyMessage = "No data available",
  className,
  pageSize: initialPageSize = 50
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(initialPageSize);
  const debounceRef = useRef(null);

  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(val);
      setCurrentPage(1);
    }, 200);
  }, []);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
    setCurrentPage(1);
  }, []);

  const filteredData = useMemo(() => {
    let result = data;
    if (debouncedQuery && searchFields.length > 0) {
      const query = debouncedQuery.toLowerCase();
      result = result.filter((item) =>
        searchFields.some((field) => {
          const value = field.split(".").reduce((obj, key) => obj?.[key], item);
          return String(value || "").toLowerCase().includes(query);
        })
      );
    }
    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        const aValue = sortConfig.key.split(".").reduce((obj, key) => obj?.[key], a);
        const bValue = sortConfig.key.split(".").reduce((obj, key) => obj?.[key], b);
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [data, debouncedQuery, searchFields, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, safePage, rowsPerPage]);

  const handleSelectAll = useCallback(() => {
    if (!onSelectRows) return;
    const pageIds = paginatedData.map((item) => item.id);
    const allPageSelected = pageIds.every((id) => selectedRows.includes(id));
    if (allPageSelected) {
      onSelectRows(selectedRows.filter((id) => !pageIds.includes(id)));
    } else {
      const newSelected = new Set([...selectedRows, ...pageIds]);
      onSelectRows([...newSelected]);
    }
  }, [paginatedData, selectedRows, onSelectRows]);

  const handleSelectAllFiltered = useCallback(() => {
    if (!onSelectRows) return;
    onSelectRows(filteredData.map((item) => item.id));
  }, [filteredData, onSelectRows]);

  const handleSelectRow = useCallback((id) => {
    if (!onSelectRows) return;
    if (selectedRows.includes(id)) {
      onSelectRows(selectedRows.filter((rowId) => rowId !== id));
    } else {
      onSelectRows([...selectedRows, id]);
    }
  }, [selectedRows, onSelectRows]);

  const allPageSelected = paginatedData.length > 0 && paginatedData.every((r) => selectedRows.includes(r.id));

  const goToPage = useCallback((page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const getPageNumbers = () => {
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
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {searchable && (
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700/60 rounded-lg text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/60 focus:border-cyan-600 transition-all"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-lg text-slate-500">Rows:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-lg text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/60"
          >
            {ROWS_PER_PAGE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/50 shadow-2xl shadow-black/40">
        <table className="w-full text-lg">
          <thead>
            <tr className="bg-slate-800/95 border-b border-slate-700/60">
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/40"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left text-lg font-bold text-cyan-400 tracking-widest uppercase",
                    column.sortable && "cursor-pointer select-none hover:text-cyan-200 transition-colors"
                  )}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-1.5">
                    {column.header}
                    {column.sortable && sortConfig.key === column.key && (
                      sortConfig.direction === "asc" ?
                        <ChevronUp className="w-3 h-3 text-cyan-400" /> :
                        <ChevronDown className="w-3 h-3 text-cyan-400" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-10 text-center text-slate-500 text-lg"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "bg-slate-900/50 hover:bg-slate-800/70 transition-colors duration-100",
                    onRowClick && "cursor-pointer",
                    selectedRows.includes(row.id) && "bg-cyan-900/20 border-l-2 border-l-cyan-500"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(row.id)}
                        onChange={() => handleSelectRow(row.id)}
                        className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/40"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 text-lg text-slate-200">
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-lg text-slate-400 px-1">
        <div className="flex items-center gap-3">
          <span>
            {filteredData.length === 0
              ? "No entries"
              : `${(safePage - 1) * rowsPerPage + 1}-${Math.min(safePage * rowsPerPage, filteredData.length)} of ${filteredData.length}`}
            {data.length !== filteredData.length && ` (filtered from ${data.length})`}
          </span>
          {selectable && selectedRows.length > 0 && (
            <span className="text-cyan-400 font-medium">{selectedRows.length} selected</span>
          )}
          {selectable && filteredData.length > 0 && selectedRows.length < filteredData.length && (
            <button
              onClick={handleSelectAllFiltered}
              className="text-lg text-cyan-400 hover:text-cyan-300 underline"
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
              className="p-1.5 rounded-md hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                    ? "bg-cyan-600 text-white"
                    : "hover:bg-slate-700 text-slate-400"
                )}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded-md hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
