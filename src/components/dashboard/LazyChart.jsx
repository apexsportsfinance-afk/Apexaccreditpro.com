import { useEffect, useState } from "react";

// Defers the ~384 KB recharts bundle off the Dashboard's critical path. recharts
// was statically imported by Dashboard.jsx, so it loaded (and parsed/executed —
// the expensive part) before the page became interactive on every login. Here it
// is imported dynamically on first chart mount; the module-level promise memoizes
// so all charts share a single fetch. Each chart shows a lightweight skeleton
// until the bundle resolves, so the dashboard shell renders immediately.
//
// Each `kind` is a faithful 1:1 move of the JSX that previously lived inline in
// Dashboard.jsx — same props, same styling. Center overlays / surrounding markup
// stay in Dashboard; this component only owns the recharts subtree.

let rechartsPromise;
const loadRecharts = () => (rechartsPromise ||= import("./rechartsBundle"));

const Skeleton = () => (
  <div className="w-full h-full animate-pulse rounded bg-white/5" aria-hidden="true" />
);

function render(R, kind, props) {
  const { ResponsiveContainer } = R;
  switch (kind) {
    case "spark-area": {
      const { AreaChart, Area } = R;
      const { data, positive } = props;
      const color = positive ? "#10b981" : "#6366f1";
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.map((v, i) => ({ v, i }))}>
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              fill={color}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }
    case "spark-bar": {
      const { BarChart, Bar } = R;
      const { data, colorClass } = props;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={(data || [0, 0, 0, 0, 0]).map((v, i) => ({ v, i }))} barSize={3}>
            <Bar dataKey="v" radius={[1, 1, 0, 0]} fill="currentColor" className={colorClass} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    case "donut-census": {
      const { PieChart, Pie, Cell, Tooltip } = R;
      const { data } = props;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={70}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900 border border-white/10 px-3 py-2 rounded-lg shadow-2xl">
                      <p className="text-[10px] font-black text-white uppercase">{payload[0].name}</p>
                      <p className="text-xl font-bold text-indigo-400">{payload[0].value}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    case "donut-spread": {
      const { PieChart, Pie, Cell, Tooltip, Legend } = R;
      const { data } = props;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius={70} outerRadius={95} paddingAngle={4} dataKey="value" stroke="none">
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  opacity={0.8}
                  className="hover:opacity-100 transition-opacity cursor-pointer"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                fontSize: "10px",
                fontWeight: "bold",
              }}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              wrapperStyle={{
                fontSize: "10px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                paddingTop: "20px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    case "area-velocity": {
      const { AreaChart, Area, XAxis, YAxis } = R;
      const { data } = props;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorVelocity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: "700" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: "700" }} width={30} />
            <Area type="monotone" dataKey="checkins" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVelocity)" />
          </AreaChart>
        </ResponsiveContainer>
      );
    }
    default:
      return null;
  }
}

export default function LazyChart({ kind, ...props }) {
  const [R, setR] = useState(null);
  useEffect(() => {
    let alive = true;
    loadRecharts().then((mod) => alive && setR(mod));
    return () => {
      alive = false;
    };
  }, []);
  if (!R) return <Skeleton />;
  return render(R, kind, props);
}
