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
  ComposedChart,
} from 'recharts';
import { Activity, Zap, Layers, Cpu, Server, TrendingUp, AlertTriangle, HardDrive, Wifi, WifiOff } from 'lucide-react';

interface TelemetryData {
  architecture: string;
  throughputMsgSec: number;
  latencyNs: number;
  timestamp: number;
  memoryBytes: number;
  heapAllocs: number;
  isNetworkless: boolean;
}

// ── Massive SKU catalog ──────────────────────────────────────────
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

const NETWORKLESS_ARCHS = ['Wasm Component', 'FFI (C-Boundary)', 'Shared Memory', 'Unix Socket'];
const NETWORKFUL_ARCHS = ['REST (HTTP/1.1)', 'gRPC (HTTP/2)', 'JSON-RPC (TCP)'];
const COLORS: Record<string, string> = {
  'Wasm Component': '#34d399',
  'FFI (C-Boundary)': '#fbbf24',
  'Shared Memory': '#a78bfa',
  'Unix Socket': '#fb923c',
  'REST (HTTP/1.1)': '#f87171',
  'gRPC (HTTP/2)': '#38bdf8',
  'JSON-RPC (TCP)': '#e879f9',
};

// Memory estimation model (same as gateway)
function estimateMemory(arch: string, batchSize: number): number {
  const estimates: Record<string, [number, number]> = {
    "Wasm Component": [2_048, 48], "FFI (C-Boundary)": [4_096, 96],
    "Shared Memory": [8_192, 64], "Unix Socket": [6_144, 128],
    "REST (HTTP/1.1)": [32_768, 1200], "gRPC (HTTP/2)": [16_384, 400],
    "JSON-RPC (TCP)": [24_576, 800],
  };
  const [base, perOrder] = estimates[arch] || [8_192, 200];
  return base + perOrder * batchSize;
}

export default function App() {
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryData[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<Record<string, TelemetryData>>({});
  const [isStreaming, setIsStreaming] = useState(true);
  const [orderCount, setOrderCount] = useState(0);
  const [fraudCount, setFraudCount] = useState(0);
  const [stockLevels, setStockLevels] = useState<Record<string, number>>(INITIAL_STOCK);
  const [throughputHistory, setThroughputHistory] = useState<{time: string; rate: number}[]>([]);
  const [fraudRate, setFraudRate] = useState(0);
  const [memoryHistory, setMemoryHistory] = useState<{time: string; [key: string]: number | string}[]>([]);
  const orderCountRef = useRef(0);

  const processOrderBatch = useCallback(() => {
    const batchSize = 500 + Math.floor(Math.random() * 1500);
    orderCountRef.current += batchSize;
    setOrderCount((prev) => prev + batchSize);
    const frauds = Math.floor(batchSize * (0.03 + Math.random() * 0.03));
    setFraudCount((prev) => prev + frauds);
    setFraudRate((0.03 + Math.random() * 0.03) * 100);
    setStockLevels((prev) => {
      const next = { ...prev };
      const skus = Object.keys(next);
      for (let i = 0; i < batchSize - frauds; i++) {
        const sku = skus[Math.floor(Math.random() * skus.length)];
        next[sku] = Math.max(0, next[sku] - (5 + Math.floor(Math.random() * 495)));
      }
      return next;
    });
    setThroughputHistory((prev) => {
      const next = [...prev, { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), rate: batchSize * 10 }];
      if (next.length > 60) return next.slice(-60);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isStreaming) return;
    const orderInterval = setInterval(processOrderBatch, 100);
    const telemetryInterval = setInterval(() => {
      const now = Date.now();
      const orderScale = Math.min(orderCountRef.current / 50000, 50);
      const lastBatch = 1000;
      const allArchs = [
        { name: 'Wasm Component', baseLat: 5000, jit: 3000, baseT: 850_000, tScale: 60_000, netless: true },
        { name: 'FFI (C-Boundary)', baseLat: 15000, jit: 8000, baseT: 120_000, tScale: 5_000, netless: true },
        { name: 'Shared Memory', baseLat: 10000, jit: 5000, baseT: 350_000, tScale: 15_000, netless: true },
        { name: 'Unix Socket', baseLat: 25000, jit: 12000, baseT: 85_000, tScale: 3_000, netless: true },
        { name: 'REST (HTTP/1.1)', baseLat: 750_000, jit: 500_000, baseT: 4_500, tScale: -80, netless: false },
        { name: 'gRPC (HTTP/2)', baseLat: 150_000, jit: 80_000, baseT: 45_000, tScale: 200, netless: false },
        { name: 'JSON-RPC (TCP)', baseLat: 1_400_000, jit: 800_000, baseT: 18_000, tScale: -300, netless: false },
      ];
      const batch = allArchs.map(a => ({
        architecture: a.name,
        latencyNs: a.baseLat + Math.floor(Math.random() * a.jit),
        throughputMsgSec: a.baseT + Math.floor(orderScale * a.tScale) + Math.floor(Math.random() * 5_000),
        timestamp: now,
        memoryBytes: estimateMemory(a.name, lastBatch),
        heapAllocs: Math.ceil(lastBatch * (a.netless ? 2 : 10)),
        isNetworkless: a.netless,
      }));
      batch.forEach(item => setCurrentMetrics(prev => ({ ...prev, [item.architecture]: item })));
      setTelemetryHistory(prev => {
        const updated = [...prev, ...batch];
        if (updated.length > 400) return updated.slice(updated.length - 400);
        return updated;
      });
      // Memory history
      setMemoryHistory(prev => {
        const entry: {time: string; [key: string]: number | string} = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
        batch.forEach(item => { entry[item.architecture] = item.memoryBytes; });
        const next = [...prev, entry];
        if (next.length > 60) return next.slice(-60);
        return next;
      });
    }, 500);
    return () => { clearInterval(orderInterval); clearInterval(telemetryInterval); };
  }, [isStreaming, processOrderBatch]);

  const totalStock = Object.values(stockLevels).reduce((a, b) => a + b, 0);
  const depletedSkus = Object.values(stockLevels).filter(s => s < 1_000_000).length;
  const avgThroughput = throughputHistory.length > 0
    ? Math.round(throughputHistory.slice(-10).reduce((a, b) => a + b.rate, 0) / Math.min(10, throughputHistory.length)) : 0;

  // Categorize current metrics
  const networklessMetrics = Object.values(currentMetrics).filter(m => m.isNetworkless);
  const networkfulMetrics = Object.values(currentMetrics).filter(m => !m.isNetworkless);
  const wasmMetric = currentMetrics['Wasm Component'];
  const restMetric = currentMetrics['REST (HTTP/1.1)'];
  const memoryAdvantage = wasmMetric && restMetric ? Math.round(restMetric.memoryBytes / wasmMetric.memoryBytes) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-sans">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-6 mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Activity className="text-emerald-400 animate-pulse" size={32} />
            PolyERP{' '}
            <span className="text-sm px-2 py-1 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono">WASI 0.3</span>
            <span className="text-xs px-2 py-1 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono">7 ARCH</span>
          </h1>
          <p className="text-gray-400 mt-1">4 Networkless + 3 Networkful — Latency / Throughput / Memory Benchmarks</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-gray-900 border border-gray-800 px-4 py-2 rounded-lg">
            <span className="text-xs block text-gray-500 font-mono uppercase">Orders</span>
            <span className="text-xl font-bold font-mono text-cyan-400">{orderCount.toLocaleString()}</span>
          </div>
          <div className="bg-gray-900 border border-gray-800 px-4 py-2 rounded-lg">
            <span className="text-xs block text-gray-500 font-mono uppercase">Fraud</span>
            <span className="text-xl font-bold font-mono text-red-400">{fraudCount.toLocaleString()}</span>
          </div>
          <div className="bg-gray-900 border border-gray-800 px-4 py-2 rounded-lg">
            <span className="text-xs block text-gray-500 font-mono uppercase">Rate</span>
            <span className="text-xl font-bold font-mono text-emerald-400">{avgThroughput.toLocaleString()}/s</span>
          </div>
          <div className="bg-gray-900 border border-emerald-900 px-4 py-2 rounded-lg border-l-4 border-l-emerald-500">
            <span className="text-xs block text-gray-500 font-mono uppercase">Mem Advantage</span>
            <span className="text-xl font-bold font-mono text-emerald-400">{memoryAdvantage}x</span>
          </div>
          <button onClick={() => setIsStreaming(!isStreaming)}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${isStreaming ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white`}>
            {isStreaming ? 'Pause' : 'Resume'}
          </button>
        </div>
      </header>

      {/* ── NETWORKLESS Cards ──────────────────────────────── */}
      <div className="mb-2 flex items-center gap-2">
        <WifiOff size={16} className="text-emerald-400" />
        <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Networkless (in-process)</span>
      </div>
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {networklessMetrics.map(m => (
          <div key={m.architecture}
            className={`p-4 rounded-xl border ${m.architecture === 'Wasm Component'
              ? 'bg-gradient-to-br from-emerald-950/40 to-gray-900 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
              : 'bg-gray-900 border-gray-800'}`}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-sm text-gray-200">{m.architecture}</h3>
              {m.architecture === 'Wasm Component' ? <Zap size={16} className="text-emerald-400" /> : <Server size={16} className="text-gray-500" />}
            </div>
            <div className="space-y-1 font-mono text-xs">
              <div><span className="text-gray-500">LAT </span><span className={m.architecture === 'Wasm Component' ? 'text-emerald-400 font-bold text-base' : 'text-gray-300'}>{(m.latencyNs / 1000).toFixed(1)} us</span></div>
              <div><span className="text-gray-500">THR </span><span className="text-gray-400 font-semibold">{m.throughputMsgSec.toLocaleString()} ops/s</span></div>
              <div><span className="text-gray-500">MEM </span><span className="text-amber-400">{(m.memoryBytes / 1024).toFixed(0)} KB</span></div>
            </div>
          </div>
        ))}
      </section>

      {/* ── NETWORKFUL Cards ───────────────────────────────── */}
      <div className="mb-2 flex items-center gap-2">
        <Wifi size={16} className="text-red-400" />
        <span className="text-sm font-bold text-red-400 uppercase tracking-wider">Networkful (network stack)</span>
      </div>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {networkfulMetrics.map(m => (
          <div key={m.architecture} className="p-4 rounded-xl border bg-gray-900 border-red-900/30">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-sm text-gray-200">{m.architecture}</h3>
              <Server size={16} className="text-red-400" />
            </div>
            <div className="space-y-1 font-mono text-xs">
              <div><span className="text-gray-500">LAT </span><span className="text-red-300">{(m.latencyNs / 1000).toFixed(0)} us</span></div>
              <div><span className="text-gray-500">THR </span><span className="text-gray-400">{m.throughputMsgSec.toLocaleString()} ops/s</span></div>
              <div><span className="text-gray-500">MEM </span><span className="text-amber-400">{(m.memoryBytes / 1024 / 1024).toFixed(1)} MB</span></div>
            </div>
          </div>
        ))}
      </section>

      {/* ── Latency Chart (all 7) ──────────────────────────── */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Cpu size={20} className="text-cyan-400" /> Latency — All 7 Architectures (us)
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={(() => {
                const timestamps = Array.from(new Set(telemetryHistory.map(d => d.timestamp))).sort();
                return timestamps.map(ts => {
                  const items = telemetryHistory.filter(d => d.timestamp === ts);
                  const row: Record<string, string | number> = { time: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) };
                  items.forEach(item => { (row as Record<string, number | string>)[item.architecture] = parseFloat((item.latencyNs / 1000).toFixed(2)); });
                  return row;
                });
              })()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" stroke="#6b7280" fontSize={10} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }} />
                <Legend verticalAlign="top" height={36} />
                {[...NETWORKLESS_ARCHS, ...NETWORKFUL_ARCHS].map(arch => (
                  <Line key={arch} type="monotone" dataKey={arch} stroke={COLORS[arch]}
                    strokeWidth={arch === 'Wasm Component' ? 3 : 1.5} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Memory Comparison Bar ────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <HardDrive size={20} className="text-amber-400" /> Memory per 1K Batch
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Object.values(currentMetrics).map(m => ({
                architecture: m.architecture.replace(/ \(.*\)/, ''),
                memoryKB: Math.round(m.memoryBytes / 1024),
                isNetworkless: m.isNetworkless,
              }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" stroke="#6b7280" fontSize={11} />
                <YAxis dataKey="architecture" type="category" stroke="#6b7280" fontSize={10} width={80} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151' }} />
                <Bar dataKey="memoryKB" fill="#fbbf24">
                  {Object.values(currentMetrics).map((entry, index) => (
                    <rect key={index} fill={entry.isNetworkless ? '#10b981' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>

      {/* ── Throughput + Memory History ────────────────────── */}
      <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Throughput over time */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-cyan-400" /> Ingestion Rate (orders/sec)
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={throughputHistory}>
                <defs><linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/><stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" stroke="#6b7280" fontSize={10} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }} />
                <Area type="monotone" dataKey="rate" stroke="#06b6d4" fill="url(#tGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory over time — networkless vs networkful */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <HardDrive size={20} className="text-amber-400" /> Memory Growth — Networkless vs Networkful
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={memoryHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" stroke="#6b7280" fontSize={10} />
                <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v: number) => `${(v / 1024).toFixed(0)}KB`} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }}
                  formatter={(value: number, name: string) => [`${(value / 1024).toFixed(1)}KB`, name]} />
                <Legend verticalAlign="top" height={28} />
                {NETWORKLESS_ARCHS.map(arch => (
                  <Line key={arch} type="monotone" dataKey={arch} stroke={COLORS[arch]} strokeWidth={arch === 'Wasm Component' ? 2.5 : 1} dot={false} />
                ))}
                {NETWORKFUL_ARCHS.map(arch => (
                  <Line key={arch} type="monotone" dataKey={arch} stroke={COLORS[arch]} strokeWidth={1} strokeDasharray="5 5" dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ── Inventory ──────────────────────────────────────── */}
      <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Server size={20} className="text-emerald-400" /> 50-SKU Inventory
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">Total: <span className="text-amber-400 font-mono font-bold">{(totalStock / 1_000_000).toFixed(1)}M</span></span>
            <span className="text-gray-500">Depleted: <span className={`font-mono font-bold ${depletedSkus > 10 ? 'text-red-400' : 'text-emerald-400'}`}>{depletedSkus}</span></span>
            <span className="text-gray-500">Fraud: <span className="text-red-400 font-mono font-bold">{fraudRate.toFixed(1)}%</span></span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-2">
          {Object.entries(stockLevels).map(([itemId, stock]) => {
            const maxStock = INITIAL_STOCK[itemId] || 50_000_000;
            const pct = (stock / maxStock) * 100;
            const isCritical = stock < 100_000;
            const isLow = stock < 1_000_000;
            return (
              <div key={itemId} className={`rounded-lg p-2 border ${isCritical ? 'bg-red-950/30 border-red-800' : isLow ? 'bg-amber-950/20 border-amber-800/50' : 'bg-gray-800 border-gray-700'}`}>
                <span className="text-[9px] text-gray-500 font-mono block truncate">{itemId}</span>
                <span className={`text-xs font-bold font-mono ${isCritical ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {stock >= 1_000_000 ? `${(stock / 1_000_000).toFixed(1)}M` : stock.toLocaleString()}
                </span>
                <div className="mt-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${isCritical ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
