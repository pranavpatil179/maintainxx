import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign, Wrench, AlertTriangle, TrendingDown, TrendingUp,
  ChevronRight, BarChart2, RefreshCw, Info, Target, Zap, Clock, Shield
} from 'lucide-react'
import { machineApi } from '../api'
import api from '../api'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend, ComposedChart
} from 'recharts'

// ─── Formatters ──────────────────────────────────────────────────────────────
const formatCurrency = (n) =>
  n >= 1_000_000 ? `₹${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000 ? `₹${(n / 1_000).toFixed(1)}K`
  : `₹${Math.round(n).toLocaleString()}`

const RECOMMENDATION_STYLE = {
  'Repair Now':        { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  text: '#f87171', glow: '#ef4444' },
  'Monitor Closely':   { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#fbbf24', glow: '#f59e0b' },
  'Delay Maintenance': { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#34d399', glow: '#10b981' },
}

// ─── Build cost curve data ────────────────────────────────────────────────────
function buildCostCurve(rul, cp, cf) {
  const points = []
  const maxRul = Math.max(rul * 2, 200)
  for (let r = 0; r <= maxRul; r += Math.ceil(maxRul / 60)) {
    const pFail = Math.exp(-r / 45.0)
    const expectedFailCost = pFail * cf
    const savingsIfRepair = expectedFailCost - cp
    points.push({
      rul: r,
      expectedFailCost: Math.round(expectedFailCost),
      plannedCost: Math.round(cp),
      savingsIfRepair: Math.round(savingsIfRepair),
    })
  }
  return points
}

// ─── Build timeline projection data ──────────────────────────────────────────
function buildTimeline(rul, cp, cf) {
  const points = []
  for (let cycle = 0; cycle <= Math.min(rul + 50, 300); cycle += 5) {
    const remainingRul = Math.max(0, rul - cycle)
    const pFail = Math.exp(-remainingRul / 45.0)
    const riskCost = pFail * cf
    const health = Math.min(100, (remainingRul / 375) * 100)
    const cumulativeRisk = riskCost
    points.push({ cycle, health: Math.round(health), riskCost: Math.round(riskCost), pFail: Math.round(pFail * 100) })
  }
  return points
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, prefix = '' }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>{prefix}{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <b>{typeof p.value === 'number' && p.value > 1000 ? formatCurrency(p.value) : p.value}</b>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CostOptimizer() {
  const [machines, setMachines] = useState([])
  const [selectedMachine, setSelectedMachine] = useState('')
  const [cp, setCp] = useState(5000)
  const [cf, setCf] = useState(50000)
  const [result, setResult] = useState(null)
  const [fleetSummary, setFleetSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fleetLoading, setFleetLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeView, setActiveView] = useState('overview') // overview | curve | timeline | fleet

  useEffect(() => {
    machineApi.getMachines().then(m => {
      setMachines(m)
      if (m.length > 0) {
        const first = m[0]
        setSelectedMachine(first.id)
        setCp(first.preventive_cost || 5000)
        setCf(first.failure_cost || 50000)
      }
    })
    fetchFleetSummary()
  }, [])

  const fetchFleetSummary = async () => {
    setFleetLoading(true)
    try {
      const r = await api.get(`/cost-optimizer/fleet-summary?cp=${cp}&cf=${cf}`)
      setFleetSummary(r.data)
    } catch (e) { /* ignore */ }
    finally { setFleetLoading(false) }
  }

  const handleCalculate = async () => {
    if (!selectedMachine) return
    setLoading(true)
    setError('')
    try {
      const r = await api.post('/cost-optimizer/calculate', {
        machine_id: selectedMachine,
        cp: Number(cp),
        cf: Number(cf),
      })
      setResult(r.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Calculation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const recStyle = result ? RECOMMENDATION_STYLE[result.recommendation] || RECOMMENDATION_STYLE['Monitor Closely'] : null
  const costCurve = result ? buildCostCurve(result.rul, result.cp, result.cf) : []
  const timeline = result ? buildTimeline(result.rul, result.cp, result.cf) : []

  const fleetChartData = fleetSummary?.fleet?.slice(0, 20).map(f => ({
    id: f.machine_id.replace('FD001-', '#'),
    savings: f.savings,
    failCost: f.expected_failure_cost,
    rec: f.recommendation,
    rul: f.rul,
    health: f.health_score,
  })) || []

  // KPI cards derived from result
  const kpis = result ? [
    {
      label: 'Current RUL', value: `${result.rul} cycles`,
      sub: `Health: ${result.health_score}%`, color: '#3b82f6', icon: Clock,
      bar: result.health_score
    },
    {
      label: 'Failure Probability', value: `${(result.failure_probability * 100).toFixed(1)}%`,
      sub: `Risk: ${result.risk_level}`,
      color: result.recommendation === 'Repair Now' ? '#ef4444' : '#f59e0b', icon: AlertTriangle,
      bar: result.failure_probability * 100
    },
    {
      label: 'Expected Failure Cost', value: formatCurrency(result.expected_failure_cost),
      sub: `If not maintained`, color: '#8b5cf6', icon: TrendingDown,
      bar: Math.min(100, (result.expected_failure_cost / result.cf) * 100)
    },
    {
      label: 'Planned Repair Cost', value: formatCurrency(result.cp),
      sub: `Labour + parts + downtime`, color: '#06b6d4', icon: Wrench,
      bar: Math.min(100, (result.cp / result.cf) * 100)
    },
    {
      label: result.savings_if_repair_now > 0 ? 'Savings if Repair Now' : 'Cost if Repair Now',
      value: formatCurrency(Math.abs(result.savings_if_repair_now)),
      sub: result.savings_if_repair_now > 0 ? '✅ Net benefit' : '⏳ Premature – delay saves money',
      color: result.savings_if_repair_now > 0 ? '#10b981' : '#f59e0b', icon: DollarSign,
      bar: 70
    },
    {
      label: 'Break-even at RUL', value: `${result.break_even_rul} cycles`,
      sub: 'Repair becomes beneficial below this',
      color: '#f59e0b', icon: Target,
      bar: (result.break_even_rul / 375) * 100
    },
  ] : []

  const VIEWS = [
    { id: 'overview', label: 'KPI Overview' },
    { id: 'curve', label: 'Cost Curve' },
    { id: 'timeline', label: 'Health Timeline' },
    { id: 'fleet', label: 'Fleet Analysis' },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {/* ── Header ── */}
      <header style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <DollarSign size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)', margin: 0 }}>
              Maintenance Cost Optimizer
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
              Probabilistic model: Optimal repair timing using P(fail) × C<sub>f</sub> vs C<sub>p</sub> — NASA CMAPSS data
            </p>
          </div>
          <div style={{ marginLeft: 'auto', padding: '6px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 20, fontSize: 12, color: '#34d399', fontWeight: 600 }}>
            ⚡ Live Model
          </div>
        </div>
      </header>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT: Inputs ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Configure Card */}
          <div className="glass-card" style={{ padding: 26 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
              <BarChart2 size={15} color="var(--accent-blue)" /> Configure Analysis
            </h2>

            {/* Machine selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 7 }}>
                Machine
              </label>
              <select
                value={selectedMachine}
                onChange={e => {
                  const mId = e.target.value
                  setSelectedMachine(mId)
                  const m = machines.find(x => x.id === mId)
                  if (m) { setCp(m.preventive_cost || 5000); setCf(m.failure_cost || 50000) }
                }}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 14, outline: 'none', cursor: 'pointer'
                }}
              >
                {machines.map(m => (
                  <option key={m.id} value={m.id}>{m.id} — {m.status}</option>
                ))}
              </select>
            </div>

            {/* Cp */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 7 }}>
                C<sub>p</sub> — Preventive Cost
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>₹</span>
                <input type="number" value={cp} onChange={e => setCp(e.target.value)} min={0}
                  style={{ width: '100%', padding: '10px 14px 10px 26px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Labour + parts + scheduled downtime</div>
            </div>

            {/* Cf */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 7 }}>
                C<sub>f</sub> — Failure / Downtime Cost
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>₹</span>
                <input type="number" value={cf} onChange={e => setCf(e.target.value)} min={0}
                  style={{ width: '100%', padding: '10px 14px 10px 26px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Emergency repair + lost production + penalties</div>
            </div>

            <button
              onClick={handleCalculate}
              disabled={loading}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
                boxShadow: '0 4px 20px rgba(245,158,11,0.3)'
              }}
            >
              {loading ? <RefreshCw size={16} className="spin" /> : <DollarSign size={16} />}
              {loading ? 'Calculating...' : 'Calculate Optimal Decision'}
            </button>

            {error && (
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 13, color: '#f87171' }}>
                {error}
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="glass-card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={13} color="var(--accent-blue)" /> Optimization Logic
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { eq: 'P(fail) = e^(−RUL/45)', desc: 'Exponential failure probability — increases as RUL decreases' },
                { eq: 'E[fail cost] = P(fail) × Cf', desc: 'Expected cost of doing nothing now' },
                { eq: 'E[fail cost] > Cp', desc: '→ Repair Now (saves money)' },
                { eq: 'RUL < 50 cycles', desc: '→ Monitor Closely (risk increasing)' },
                { eq: 'E[fail cost] < Cp', desc: '→ Delay Maintenance (too early)' },
              ].map((item, i) => (
                <div key={i} style={{ borderLeft: '2px solid rgba(245,158,11,0.3)', paddingLeft: 10 }}>
                  <code style={{ color: '#f59e0b', fontSize: 11, fontFamily: 'monospace' }}>{item.eq}</code>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Cf/Cp ratio insight */}
          {cp > 0 && cf > 0 && (
            <div className="glass-card" style={{ padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.4px' }}>Cost Ratio Analysis</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>C<sub>f</sub> / C<sub>p</sub> ratio</span>
                  <span style={{ fontWeight: 700, color: '#f59e0b' }}>{(cf / cp).toFixed(1)}×</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Break-even P(fail)</span>
                  <span style={{ fontWeight: 700, color: '#3b82f6' }}>{((cp / cf) * 100).toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Break-even RUL</span>
                  <span style={{ fontWeight: 700, color: '#10b981' }}>
                    {cf > 0 && cp > 0 && cp < cf ? `${(-45 * Math.log(cp / cf)).toFixed(0)} cycles` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Results ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <AnimatePresence mode="wait">
            {result ? (
              <motion.div key={result.machine_id + result.recommendation}
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>

                {/* Recommendation Banner */}
                <div className="glass-card" style={{
                  padding: 26, marginBottom: 20,
                  background: recStyle.bg, border: `1px solid ${recStyle.border}`,
                  boxShadow: `0 0 40px ${recStyle.glow}18`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                    <div style={{ fontSize: 44 }}>{result.recommendation_icon}</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                        Recommendation for {result.machine_id}
                      </div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: recStyle.text, letterSpacing: '-0.5px' }}>
                        {result.recommendation}
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Fail probability now</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: recStyle.text }}>
                        {(result.failure_probability * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
                    padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: 10
                  }}>
                    {result.reason}
                  </div>
                </div>

                {/* View Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-secondary)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
                  {VIEWS.map(v => (
                    <button key={v.id} onClick={() => setActiveView(v.id)} style={{
                      padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600,
                      background: activeView === v.id ? 'var(--bg-card)' : 'transparent',
                      color: activeView === v.id ? 'var(--text-primary)' : 'var(--text-muted)',
                      boxShadow: activeView === v.id ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                      transition: 'all 0.15s'
                    }}>{v.label}</button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={activeView}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>

                    {/* ─ KPI OVERVIEW ─ */}
                    {activeView === 'overview' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                        {kpis.map((kpi, i) => {
                          const Icon = kpi.icon
                          return (
                            <motion.div
                              key={i} className="glass-card"
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.07 }}
                              style={{ padding: 20 }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                  {kpi.label}
                                </div>
                                <Icon size={14} color={kpi.color} />
                              </div>
                              <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color, marginBottom: 4 }}>{kpi.value}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{kpi.sub}</div>
                              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, kpi.bar)}%` }}
                                  transition={{ duration: 0.8, delay: i * 0.07 + 0.3 }}
                                  style={{ height: '100%', background: kpi.color, borderRadius: 2 }}
                                />
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    )}

                    {/* ─ COST CURVE ─ */}
                    {activeView === 'curve' && (
                      <div className="glass-card" style={{ padding: 24 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Expected Cost vs RUL Curve</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
                          Shows how expected failure cost (P(fail) × C<sub>f</sub>) compares to planned repair cost (C<sub>p</sub>) across all RUL values. The crossover point is the <strong>break-even RUL</strong>.
                        </p>
                        <ResponsiveContainer width="100%" height={320}>
                          <ComposedChart data={costCurve} margin={{ top: 4, right: 16, left: 10, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                            <XAxis dataKey="rul" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} label={{ value: 'RUL (cycles)', position: 'insideBottom', fill: 'var(--text-muted)', dy: 14, fontSize: 12 }} />
                            <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip prefix="RUL=" />} />
                            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                            <ReferenceLine
                              x={result.break_even_rul}
                              stroke="#f59e0b"
                              strokeDasharray="5 4"
                              strokeWidth={2}
                              label={{ value: `Break-even (${result.break_even_rul})`, fill: '#f59e0b', fontSize: 11, dy: -6 }}
                            />
                            <ReferenceLine
                              x={result.rul}
                              stroke={recStyle.glow}
                              strokeDasharray="3 3"
                              strokeWidth={2}
                              label={{ value: `Current RUL`, fill: recStyle.text, fontSize: 11, dy: -6 }}
                            />
                            <Area
                              type="monotone" dataKey="expectedFailCost"
                              name="Expected Failure Cost" fill="rgba(239,68,68,0.08)"
                              stroke="#ef4444" strokeWidth={2} dot={false}
                            />
                            <Line
                              type="monotone" dataKey="plannedCost"
                              name="Planned Repair Cost" stroke="#3b82f6"
                              strokeWidth={2.5} dot={false} strokeDasharray="6 3"
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
                          🔴 Expected failure cost &nbsp;|&nbsp; 🔵 Fixed planned repair cost (C<sub>p</sub>) &nbsp;|&nbsp; 🟡 Break-even point
                        </div>
                      </div>
                    )}

                    {/* ─ HEALTH TIMELINE ─ */}
                    {activeView === 'timeline' && (
                      <div className="glass-card" style={{ padding: 24 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Health & Risk Timeline Projection</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
                          Projected health score and failure risk (%) as the machine continues to operate from its current state.
                        </p>
                        <ResponsiveContainer width="100%" height={320}>
                          <ComposedChart data={timeline} margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                            <XAxis dataKey="cycle" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} label={{ value: 'Projected Cycles From Now', position: 'insideBottom', fill: 'var(--text-muted)', dy: 14, fontSize: 12 }} />
                            <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} domain={[0, 100]} label={{ value: 'Health %', angle: -90, fill: 'var(--text-muted)', fontSize: 11, dx: -16 }} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} domain={[0, 100]} label={{ value: 'Fail Risk %', angle: 90, fill: 'var(--text-muted)', fontSize: 11, dx: 16 }} />
                            <Tooltip content={<CustomTooltip prefix="Cycle +" />} />
                            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                            <Area yAxisId="left" type="monotone" dataKey="health" name="Remaining Health %" fill="rgba(16,185,129,0.1)" stroke="#10b981" strokeWidth={2} dot={false} />
                            <Line yAxisId="right" type="monotone" dataKey="pFail" name="Failure Risk %" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* ─ FLEET ANALYSIS ─ */}
                    {activeView === 'fleet' && (
                      <div className="glass-card" style={{ padding: 24 }}>
                        {fleetLoading ? (
                          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                            <RefreshCw size={22} className="spin" style={{ margin: '0 auto 10px' }} />
                            <div>Loading fleet data...</div>
                          </div>
                        ) : fleetSummary ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Fleet Cost Savings Potential</h3>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontSize: 13, color: '#10b981', fontWeight: 700 }}>
                                  {formatCurrency(fleetSummary.total_potential_savings)} total savings
                                </span>
                                <button onClick={fetchFleetSummary} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <RefreshCw size={12} /> Refresh
                                </button>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                              {[
                                { label: 'Repair Now', count: fleetSummary.repair_now_count, color: '#ef4444' },
                                { label: 'Monitor', count: fleetSummary.monitor_count, color: '#f59e0b' },
                                { label: 'Delay', count: fleetSummary.delay_count, color: '#10b981' },
                              ].map((b, i) => (
                                <div key={i} style={{ padding: '6px 14px', borderRadius: 20, background: `${b.color}15`, border: `1px solid ${b.color}30`, fontSize: 13, fontWeight: 600, color: b.color }}>
                                  {b.count} {b.label}
                                </div>
                              ))}
                            </div>
                            <ResponsiveContainer width="100%" height={240}>
                              <BarChart data={fleetChartData} margin={{ top: 4, right: 8, left: 10, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="id" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip prefix="Machine " />} />
                                <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
                                <Bar dataKey="savings" name="Net Savings" radius={[4, 4, 0, 0]}>
                                  {fleetChartData.map((entry, i) => (
                                    <Cell key={i} fill={
                                      entry.rec === 'Repair Now' ? '#ef4444'
                                      : entry.rec === 'Monitor Closely' ? '#f59e0b'
                                      : '#10b981'
                                    } />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </>
                        ) : null}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Empty state with a live cost preview */}
                <div className="glass-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', marginBottom: 20 }}>
                  <DollarSign size={52} style={{ margin: '0 auto 16px', opacity: 0.25 }} />
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Select a Machine & Calculate</div>
                  <div style={{ fontSize: 13, maxWidth: 380, margin: '0 auto' }}>
                    Configure C<sub>p</sub> and C<sub>f</sub>, then hit Calculate to run the cost optimization model.
                    The break-even RUL will be shown instantly.
                  </div>
                  {cp > 0 && cf > 0 && (
                    <div style={{ marginTop: 24, padding: '16px 24px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, display: 'inline-block' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Break-even RUL (current params)</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>
                        {cf > cp ? `${(-45 * Math.log(cp / cf)).toFixed(0)} cycles` : 'N/A (Cp > Cf)'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        Repair is cost-effective below this RUL
                      </div>
                    </div>
                  )}
                </div>

                {/* Fleet summary always visible */}
                {fleetSummary && (
                  <div className="glass-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>💰 Fleet Savings Potential</h2>
                      <span style={{ fontSize: 13, color: '#10b981', fontWeight: 700 }}>{formatCurrency(fleetSummary.total_potential_savings)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                      {[
                        { label: 'Repair Now', count: fleetSummary.repair_now_count, color: '#ef4444' },
                        { label: 'Monitor', count: fleetSummary.monitor_count, color: '#f59e0b' },
                        { label: 'Delay', count: fleetSummary.delay_count, color: '#10b981' },
                      ].map((b, i) => (
                        <div key={i} style={{ padding: '5px 12px', borderRadius: 20, background: `${b.color}15`, border: `1px solid ${b.color}30`, fontSize: 13, fontWeight: 600, color: b.color }}>
                          {b.count} {b.label}
                        </div>
                      ))}
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={fleetChartData} margin={{ top: 4, right: 8, left: 10, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="id" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={0} stroke="var(--border)" />
                        <Bar dataKey="savings" radius={[3, 3, 0, 0]}>
                          {fleetChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.rec === 'Repair Now' ? '#ef4444' : entry.rec === 'Monitor Closely' ? '#f59e0b' : '#10b981'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
