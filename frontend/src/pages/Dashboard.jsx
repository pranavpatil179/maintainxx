import React, { useEffect, useState } from 'react'
import { getPredictionsSummary, taskApi, workCenterApi, getHealthTrend } from '../api'
import { Activity, AlertTriangle, Cpu, ActivitySquare, Factory, ClipboardCheck, Clock, TrendingUp, Trash2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { motion } from 'framer-motion'

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [workCenters, setWorkCenters] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboard = () => {
      Promise.all([
        getPredictionsSummary(), 
        taskApi.getTasks(),
        workCenterApi.getWorkCenters(),
        getHealthTrend()
      ])
        .then(([sumRes, taskRes, wcRes, trendRes]) => {
          setSummary(sumRes)
          setWorkOrders(taskRes)
          setWorkCenters(wcRes)
          setTrend(trendRes)
          setLoading(false)
        })
        .catch(e => {
          console.error(e)
          setLoading(false)
        })
    }
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Delete this work order?')) return
    try {
      await taskApi.deleteTask(id)
      // Refresh immediately
      Promise.all([
        getPredictionsSummary(), 
        taskApi.getTasks(),
        workCenterApi.getWorkCenters(),
        getHealthTrend()
      ]).then(([sumRes, taskRes, wcRes, trendRes]) => {
        setSummary(sumRes)
        setWorkOrders(taskRes)
        setWorkCenters(wcRes)
        setTrend(trendRes)
      })
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }}>
      <div className="spinner" />
    </div>
  )

  const stats = [
    { title: 'Total Machines', value: summary?.total_machines || 0, icon: Cpu, color: '#3b82f6' },
    { title: 'Predictive Alerts', value: summary?.at_risk_machines || 0, icon: AlertTriangle, color: '#ef4444' },
    { title: 'Active Work Orders', value: workOrders.filter(o => o.status !== 'resolved').length, icon: ClipboardCheck, color: '#8b5cf6' },
    { title: 'Fleet OEE', value: summary?.fleet_oee || '82.4%', icon: TrendingUp, color: '#10b981' }
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Command Center</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Intelligent maintenance operation for <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>Skyline Dynamics</span></p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Shift status</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pulse-dot green" /> Morning Alpha
            </div>
          </div>
        </div>
      </header>

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
        {stats.map((s, i) => (
          <div key={i} className="glass-card kpi-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.title}</div>
                <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8, color: 'var(--text-primary)' }}>{s.value}</div>
              </div>
              <div style={{ background: `${s.color}15`, padding: 10, borderRadius: 12, border: `1px solid ${s.color}30` }}>
                <s.icon size={20} color={s.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Main Chart */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Fleet Health & Reliability</h2>
              <div style={{ fontSize: 12, display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} /> Actual</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} /> Predicted</div>
              </div>
            </div>
            <div style={{ height: 320, background: 'var(--bg-primary)', borderRadius: 14, padding: '24px 16px 8px 0' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={t => new Date(t).toLocaleTimeString()} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-card)' }}
                  />
                  <Area type="monotone" dataKey="health_score" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorHealth)" activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Work Centers Summary Snippet */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Factory size={18} color="var(--accent-blue)" /> Efficiency Breakdown
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {workCenters.slice(0, 8).map(wc => (
                  <div key={wc.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span style={{ fontWeight: 500 }}>{wc.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{(wc.efficiency * 100).toFixed(1)}%</span>
                    </div>
                    <div className="health-bar" style={{ height: 4 }}>
                      <div className="health-bar-fill" style={{ width: `${wc.efficiency * 100}%`, background: 'var(--accent-blue)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color="var(--accent-amber)" /> Impending Failures
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {summary?.risk_breakdown?.High > 0 ? (
                  <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 2 }}>CRITICAL LEVEL</div>
                    <div style={{ fontSize: 14 }}>{summary.risk_breakdown.High} units require immediate breakout</div>
                  </div>
                ) : (
                  <div style={{ padding: 12, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>NO CRITICAL RISKS</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Panel for Dashboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Active Tasks / Orders */}
          <div className="glass-card" style={{ padding: 24, flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Work Order Stream</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {workOrders.slice(0, 10).map(order => (
                <div key={order.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>#{order.id}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className={order.priority === 'critical' ? 'badge-high' : 'badge-medium'} style={{ fontSize: 10 }}>{order.priority}</span>
                      <button 
                        onClick={() => handleDeleteTask(order.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{order.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Due: {order.due_date}</div>
                </div>
              ))}
              <button 
                className="btn-secondary" 
                style={{ width: '100%', fontSize: 13 }}
                onClick={() => window.location.href = '/tasks'}
              >
                View All Orders
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
