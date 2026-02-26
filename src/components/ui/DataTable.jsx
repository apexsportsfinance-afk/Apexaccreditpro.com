import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { ChevronUp, ChevronDown, Search } from "lucide-react";
import { cn } from "../../lib/utils";

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
  className
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const filteredData = useMemo(() => {
    let result = [...data];
    if (searchQuery && searchFields.length > 0) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        searchFields.some((field) => {
          const value = field.split(".").reduce((obj, key) => obj?.[key], item);
          return String(value || "").toLowerCase().includes(query);
        })
      );
    }
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = sortConfig.key.split(".").reduce((obj, key) => obj?.[key], a);
        const bValue = sortConfig.key.split(".").reduce((obj, key) => obj?.[key], b);
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [data, searchQuery, searchFields, sortConfig]);

  const handleSelectAll = () => {
    if (selectedRows.length === filteredData.length) {
      onSelectRows?.([]);
    } else {
      onSelectRows?.(filteredData.map((item) => item.id));
    }
  };

  const handleSelectRow = (id) => {
    if (selectedRows.includes(id)) {
      onSelectRows?.(selectedRows.filter((rowId) => rowId !== id));
    } else {
      onSelectRows?.([...selectedRows, id]);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {searchable && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700/60 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/60 focus:border-cyan-600 transition-all"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-700/50 shadow-2xl shadow-black/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/95 border-b border-slate-700/60">
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={filteredData.length > 0 && selectedRows.length === filteredData.length}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/40"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-bold text-cyan-400 tracking-widest uppercase",
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
            {filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-10 text-center text-slate-500 text-sm"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredData.map((row, index) => (
                <motion.tr
                  key={row.id || index}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={cn(
                    "bg-slate-900/50 hover:bg-slate-800/70 transition-all duration-150",
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
                    <td key={column.key} className="px-4 py-3 text-sm text-slate-200">
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>Showing {filteredData.length} of {data.length} entries</span>
        {selectable && selectedRows.length > 0 && (
          <span className="text-cyan-400 font-medium">{selectedRows.length} selected</span>
        )}
      </div>
    </div>
  );
}