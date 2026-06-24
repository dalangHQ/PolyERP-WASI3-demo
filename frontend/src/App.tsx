import { useEffect, useState, useCallback } from 'react';
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
} from 'recharts';
import { Activity, Zap, Layers, Cpu, Server } from 'lucide-react';

interface TelemetryData {
  architecture: string;
  throughputMsgSec: number;
  latencyNs: number;
  timestamp: number;
}

export default function App() {
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryData[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<Record<string, TelemetryData>>({});
  const [isStreaming, setIsStreaming] = useState(true);
  const [orderCount, setOrderCount] = useState(0);
  const [fraudCount, setFraudCount] = useState(0);
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({
    'ITEM-99': 1_000_000,
    'ITEM-42': 500_000,
    'ITEM-07': 750_000,
    'ITEM-21': 300_000,
  });

  // Simulate processing a batch of orders
  const processOrderBatch = useCallback(() => {
    const batchSize = Math.floor(Math.random() * 15) + 5;
    setOrderCount((prev) => prev + batchSize);

    // Simulate some fraud detections
    const frauds = Math.floor(Math.random() * 3);
    setFraudCount((prev) => prev + frauds);

    // Simulate stock deductions
    setStockLevels((prev) => {
      const next = { ...prev };
      const items = Object.keys(next);
      for (let i = 0; i < batchSize - frauds; i++) {
        const item = items[Math.floor(Math.random() * items.length)];
        const deduct = Math.floor(Math.random() * 10) + 1;
        next[item] = Math.max(0, next[item] - deduct);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isStreaming) return;

    // 1. Simulate the uninterrupted frontend-to-Wasm stream pipeline ingestion loop
    const orderInterval = setInterval(processOrderBatch, 100);

    // 2. Consume the Wasm Telemetry Stream
    // In a real production deployment, this maps directly to your instantiated
    // `poly-erp-composed.wasm` running in the browser or streaming over SSE.
    const telemetryInterval = setInterval(() => {
      const now = Date.now();
      const baseWasmLatency = 8000 + Math.floor(Math.random() * 4000); // ~8-12 microseconds

      const mockBatch: TelemetryData[] = [
        {
          architecture: 'Wasm Component',
          latencyNs: baseWasmLatency,
          throughputMsgSec: 850_000 + Math.floor(Math.random() * 50_000),
          timestamp: now,
        },
        {
          architecture: 'REST (Network IPC)',
          latencyNs:
            baseWasmLatency + 1_500_000 + Math.floor(Math.random() * 300_000),
          throughputMsgSec: 4_500 + Math.floor(Math.random() * 500),
          timestamp: now,
        },
        {
          architecture: 'FFI (C-Boundary)',
          latencyNs:
            baseWasmLatency + 450_000 + Math.floor(Math.random() * 80_000),
          throughputMsgSec: 120_000 + Math.floor(Math.random() * 12_000),
          timestamp: now,
        },
        {
          architecture: 'JSON-RPC (stdio Pipe)',
          latencyNs:
            baseWasmLatency + 2_800_000 + Math.floor(Math.random() * 600_000),
          throughputMsgSec: 18_000 + Math.floor(Math.random() * 2_000),
          timestamp: now,
        },
      ];

      mockBatch.forEach((item) => {
        setCurrentMetrics((prev) => ({ ...prev, [item.architecture]: item }));
      });

      setTelemetryHistory((prev) => {
        const updated = [...prev, ...mockBatch];
        // Keep a rolling window of the last 40 data points to avoid memory leaks
        if (updated.length > 160) return updated.slice(updated.length - 160);
        return updated;
      });
    }, 500);

    return () => {
      clearInterval(orderInterval);
      clearInterval(telemetryInterval);
    };
  }, [isStreaming, processOrderBatch]);

  // Format data specifically for Recharts Line graph layout
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
        // Convert to microseconds for better readability on graph axes
        (row as Record<string, number | string>)[item.architecture] = parseFloat(
          (item.latencyNs / 1000).toFixed(2),
        );
      });
      return row;
    });
  };

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
          </h1>
          <p className="text-gray-400 mt-1">
            Real-time Telemetry & Microsecond Observability Benchmarks
          </p>
        </div>
        <div className="flex items-center gap-4">
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
            <Cpu size={20} className="text-cyan-400" /> Real-Time Boundary
            Execution Latency (Microseconds - Lower is Better)
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
            <Layers size={20} className="text-purple-400" /> Max Operational
            Saturation (Msg/Sec)
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

      {/* Inventory Stock Levels */}
      <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Server size={20} className="text-emerald-400" /> Live Inventory
          Stock Levels
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stockLevels).map(([itemId, stock]) => (
            <div
              key={itemId}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4"
            >
              <span className="text-xs text-gray-500 font-mono block">
                {itemId}
              </span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                {stock.toLocaleString()}
              </span>
              <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (stock / 1_000_000) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
