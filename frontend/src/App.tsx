import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from 'recharts';
import { Activity, Zap, Layers, Cpu, Server, TrendingUp, AlertTriangle } from 'lucide-react';

interface TelemetryData {
  architecture: string;
  throughputMsgSec: number;
  latencyNs: number;
  timestamp: number;
}

// ── Massive SKU catalog matching the Rust inventory ──────────────
const SKU_CATALOG: string[] = [];
for (let w = 0; w < 5; w++) {
  for (let i = 0; i < 10; i++) {
    SKU_CATALOG.push(`WH${w}-SKU-${String(i).padStart(4, '0')}`);
  }
}

const INITIAL_STOCK: Record<string, number> = {};
for (let w = 0; w < 5; w++) {
  for (let i = 0; i < 10; i++) {
    const sku = `WH${w}-SKU-${String(i).padStart(4, '0')}`;
    INITIAL_STOCK[sku] = 10_000_000 + w * 8_000_000 + i * 500_000;
  }
}

const USER_PREFIXES = ['usr', 'guest', 'vip', 'corp', 'bot'];

export default function App() {
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryData[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<Record<string, TelemetryData>>({});
  const [isStreaming, setIsStreaming] = useState(true);
  const [orderCount, setOrderCount] = useState(0);
  const [fraudCount, setFraudCount] = useState(0);
  const [stockLevels, setStockLevels] = useState<Record<string, number>>(INITIAL_STOCK);
  const [throughputHistory, setThroughputHistory] = useState<{time: string; rate: number}[]>([]);
  const [fraudRate, setFraudRate] = useState(0);
  const orderCountRef = useRef(0);

  // ── MASSIVE batch processing: 500-2000 orders per tick ──────────
  const processOrderBatch = useCallback(() => {
    // Massive batch: 500-2000 orders per tick (10x the previous scale)
    const batchSize = 500 + Math.floor(Math.random() * 1500);
    orderCountRef.current += batchSize;
    setOrderCount((prev) => prev + batchSize);

    // Fraud: ~3-6% of orders are fraudulent in massive flows
    const frauds = Math.floor(batchSize * (0.03 + Math.random() * 0.03));
    setFraudCount((prev) => prev + frauds);
    setFraudRate((0.03 + Math.random() * 0.03) * 100);

    // Stock deductions across the full SKU catalog
    setStockLevels((prev) => {
      const next = { ...prev };
      const skus = Object.keys(next);
      const validOrders = batchSize - frauds;
      for (let i = 0; i < validOrders; i++) {
        const sku = skus[Math.floor(Math.random() * skus.length)];
        // Massive deductions: 5-500 units per order
        const deduct = 5 + Math.floor(Math.random() * 495);
        next[sku] = Math.max(0, next[sku] - deduct);
      }
      return next;
    });

    // Track throughput rate
    setThroughputHistory((prev) => {
      const next = [...prev, {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        rate: batchSize * 10, // 10 ticks/sec simulated
      }];
      if (next.length > 60) return next.slice(-60);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isStreaming) return;

    // 1. Massive order ingestion: 10 ticks/sec, 500-2000 orders each = 5K-20K orders/sec
    const orderInterval = setInterval(processOrderBatch, 100);

    // 2. High-frequency telemetry stream: 2 updates/sec
    const telemetryInterval = setInterval(() => {
      const now = Date.now();
      // Wasm Component scales with throughput — massive data = massive advantage
      const baseWasmLatency = 5000 + Math.floor(Math.random() * 3000);
      const orderScale = Math.min(orderCountRef.current / 50000, 50);

      const mockBatch: TelemetryData[] = [
        {
          architecture: 'Wasm Component',
          latencyNs: baseWasmLatency,
          // Throughput scales with volume: 850K → 4M+ ops/s at massive scale
          throughputMsgSec: 850_000 + Math.floor(orderScale * 60_000) + Math.floor(Math.random() * 50_000),
          timestamp: now,
        },
        {
          architecture: 'REST (Network IPC)',
          latencyNs: baseWasmLatency + 1_500_000 + Math.floor(Math.random() * 500_000),
          // REST degrades under load
          throughputMsgSec: Math.max(500, 4_500 - Math.floor(orderScale * 80) + Math.floor(Math.random() * 500)),
          timestamp: now,
        },
        {
          architecture: 'FFI (C-Boundary)',
          latencyNs: baseWasmLatency + 450_000 + Math.floor(Math.random() * 100_000),
          // FFI holds steady but doesn't scale
          throughputMsgSec: 120_000 + Math.floor(Math.random() * 12_000),
          timestamp: now,
        },
        {
          architecture: 'JSON-RPC (stdio Pipe)',
          latencyNs: baseWasmLatency + 2_800_000 + Math.floor(Math.random() * 800_000),
          // JSON-RPC collapses under load
          throughputMsgSec: Math.max(1000, 18_000 - Math.floor(orderScale * 300) + Math.floor(Math.random() * 2_000)),
          timestamp: now,
        },
      ];

      mockBatch.forEach((item) => {
        setCurrentMetrics((prev) => ({ ...prev, [item.architecture]: item }));
      });

      setTelemetryHistory((prev) => {
        const updated = [...prev, ...mockBatch];
        // Larger rolling window for massive data: 400 points
        if (updated.length > 400) return updated.slice(updated.length - 400);
        return updated;
      });
    }, 500);

    return () => {
      clearInterval(orderInterval);
      clearInterval(telemetryInterval);
    };
  }, [isStreaming, processOrderBatch]);

  // Format data for Recharts Line graph
  const getLineChartData = () => {
    const timestamps = Array.from(
      new Set(telemetryHistory.map((d) => d.timestamp)),
    ).sort();
    return timestamps.map((ts) => {
      const items = telemetryHistory.filter((d) => d.timestamp === ts);
      const row: Record<string, string | number> = {
        time: new Date(ts).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
      items.forEach((item) => {
        (row as Record<string, number | string>)[item.architecture] = parseFloat(
          (item.latencyNs / 1000).toFixed(2),
        );
      });
      return row;
    });
  };

  // Compute aggregate stats
  const totalStock = Object.values(stockLevels).reduce((a, b) => a + b, 0);
  const depletedSkus = Object.values(stockLevels).filter(s => s < 1_000_000).length;
  const avgThroughput = throughputHistory.length > 0
    ? Math.round(throughputHistory.slice(-10).reduce((a, b) => a + b.rate, 0) / Math.min(10, throughputHistory.length))
    : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-sans">
      {/* Header Banner */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-6 mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Activity className="text-emerald-400 animate-pulse" size={32} />
            PolyERP{' '}
            <span className="text-sm px-2 py-1 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono">
              WASI 0.3 Runtime
            </span>
            <span className="text-xs px-2 py-1 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono">
              MASSIVE DATA FLOWS
            </span>
          </h1>
          <p className="text-gray-400 mt-1">
            Real-time Telemetry &amp; Microsecond Observability — Massive-Scale Pipeline Benchmarks
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-gray-900 border border-gray-800 px-4 py-2 rounded-lg">
            <span className="text-xs block text-gray-500 font-mono uppercase">
              Total Ingested Orders
            </span>
            <span className="text-xl font-bold font-mono text-cyan-400">
              {orderCount.toLocaleString()}
            </span>
          </div>
          <div className="bg-gray-900 border border-gray-800 px-4 py-2 rounded-lg">
            <span className="text-xs block text-gray-500 font-mono uppercase">
              Fraud Detected
            </span>
            <span className="text-xl font-bold font-mono text-red-400">
              {fraudCount.toLocaleString()}
            </span>
          </div>
          <div className="bg-gray-900 border border-gray-800 px-4 py-2 rounded-lg">
            <span className="text-xs block text-gray-500 font-mono uppercase">
              Ingestion Rate
            </span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {avgThroughput.toLocaleString()}/s
            </span>
          </div>
          <div className="bg-gray-900 border border-gray-800 px-4 py-2 rounded-lg">
            <span className="text-xs block text-gray-500 font-mono uppercase">
              Aggregate Stock
            </span>
            <span className="text-xl font-bold font-mono text-amber-400">
              {(totalStock / 1_000_000).toFixed(1)}M
            </span>
          </div>
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
              isStreaming
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isStreaming ? 'Pause Stream' : 'Resume Stream'}
          </button>
        </div>
      </header>

      {/* Metric Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Object.values(currentMetrics).map((metrics) => {
          const isWasm = metrics.architecture === 'Wasm Component';
          return (
            <div
              key={metrics.architecture}
              className={`p-5 rounded-xl border ${
                isWasm
                  ? 'bg-gradient-to-br from-emerald-950/40 to-gray-900 border-emerald-500/40 shadow-emerald-950/20 shadow-lg'
                  : 'bg-gray-900 border-gray-800'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg text-gray-200">
                  {metrics.architecture}
                </h3>
                {isWasm ? (
                  <Zap size={18} className="text-emerald-400" />
                ) : (
                  <Server size={18} className="text-gray-500" />
                )}
              </div>
              <div className="space-y-2 font-mono">
                <div>
                  <span className="text-xs text-gray-500 block">LATENCY</span>
                  <span
                    className={`text-xl font-bold ${
                      isWasm ? 'text-emerald-400' : 'text-gray-300'
                    }`}
                  >
                    {(metrics.latencyNs / 1000).toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}{' '}
                    us
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">THROUGHPUT</span>
                  <span className="text-md font-semibold text-gray-400">
                    {metrics.throughputMsgSec.toLocaleString()} ops/s
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Telemetry Visualizations */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Real-time Latency Chart */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Cpu size={20} className="text-cyan-400" /> Real-Time Latency
            (Microseconds — Massive Data Flow)
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={getLineChartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#374151',
                    color: '#f3f4f6',
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <Line
                  type="monotone"
                  dataKey="Wasm Component"
                  stroke="#34d399"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="FFI (C-Boundary)"
                  stroke="#fbbf24"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="JSON-RPC (stdio Pipe)"
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="REST (Network IPC)"
                  stroke="#f87171"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Throughput Comparison */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Layers size={20} className="text-purple-400" /> Throughput
            Saturation (ops/s)
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Object.values(currentMetrics)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="architecture"
                  stroke="#6b7280"
                  fontSize={9}
                  tickLine={false}
                />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#374151',
                  }}
                />
                <Bar dataKey="throughputMsgSec" fill="#8b5cf6">
                  {Object.values(currentMetrics).map((entry, index) => (
                    <rect
                      key={`bar-${index}`}
                      fill={
                        entry.architecture === 'Wasm Component'
                          ? '#10b981'
                          : '#4b5563'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>

      {/* Ingestion Throughput Over Time */}
      <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-cyan-400" /> Order Ingestion
          Throughput Over Time (orders/sec)
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={throughputHistory}>
              <defs>
                <linearGradient id="throughputGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" stroke="#6b7280" fontSize={10} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  borderColor: '#374151',
                  color: '#f3f4f6',
                }}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#06b6d4"
                fill="url(#throughputGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Inventory Stock Levels — Full 50-SKU Catalog */}
      <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
          <Server size={20} className="text-emerald-400" /> Live Inventory
          Stock Levels — 50 SKU Catalog
        </h3>
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="text-gray-500">
            Total: <span className="text-amber-400 font-mono font-bold">{(totalStock / 1_000_000).toFixed(1)}M units</span>
          </span>
          <span className="text-gray-500">
            Depleted (&lt;1M): <span className={`font-mono font-bold ${depletedSkus > 10 ? 'text-red-400' : 'text-emerald-400'}`}>{depletedSkus} SKUs</span>
          </span>
          <span className="text-gray-500">
            Fraud Rate: <span className="text-red-400 font-mono font-bold">{fraudRate.toFixed(1)}%</span>
          </span>
          {depletedSkus > 10 && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle size={14} /> High depletion
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3">
          {Object.entries(stockLevels).map(([itemId, stock]) => {
            const maxStock = INITIAL_STOCK[itemId] || 50_000_000;
            const pct = (stock / maxStock) * 100;
            const isLow = stock < 1_000_000;
            const isCritical = stock < 100_000;
            return (
              <div
                key={itemId}
                className={`rounded-lg p-3 border ${
                  isCritical
                    ? 'bg-red-950/30 border-red-800'
                    : isLow
                    ? 'bg-amber-950/20 border-amber-800/50'
                    : 'bg-gray-800 border-gray-700'
                }`}
              >
                <span className="text-[10px] text-gray-500 font-mono block truncate">
                  {itemId}
                </span>
                <span className={`text-sm font-bold font-mono ${
                  isCritical ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {stock >= 1_000_000 ? `${(stock / 1_000_000).toFixed(1)}M` : stock.toLocaleString()}
                </span>
                <div className="mt-1.5 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isCritical ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
