// Thin re-export barrel of ONLY the recharts pieces the dashboard uses. Static
// named re-exports let Rollup tree-shake recharts down to these components, while
// LazyChart dynamically imports this module so the bundle still loads off the
// critical path. (Dynamically importing "recharts" directly pulls the whole
// namespace and disables tree-shaking — ~146 KB larger.)
export {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
} from "recharts";
