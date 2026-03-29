import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getPredictions } from '../api'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'

export default function LiveMonitoring() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryParams = new URLSearchParams(location.search)
  const categoryFilter = queryParams.get('category')
  
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  useEffect(() => {
    const fetchLive = () => {
      setIsFetching(true)
      getPredictions().then(data => {
        let filtered = data
        if (categoryFilter) {
          filtered = data.filter(p => p.category_id === parseInt(categoryFilter))
        }
        setPredictions(filtered)
        setLoading(false)
        setLastUpdated(new Date())
        setTimeout(() => setIsFetching(false), 500)
      })
    }
    fetchLive()
    const interval = setInterval(fetchLive, 2000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div className="spinner" style={{ margin: '100px auto' }} />

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>Live Monitoring</h1>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: isFetching ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              color: isFetching ? '#3b82f6' : '#10b981',
              transition: 'all 0.3s ease'
            }}>
              <span className={`pulse-dot ${isFetching ? 'blue' : 'green'}`} />
              {isFetching ? 'FETCHING...' : `LIVE: ${lastUpdated.toLocaleTimeString()}`}
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Real-time sensor streams (updating every 2s)</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="badge-high">High Risk</div>
          <div className="badge-medium">Medium Risk</div>
          <div className="badge-low">Healthy</div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {predictions.map(p => (
          <motion.div
            key={p.machine_id}
            className="glass-card"
            style={{ padding: 20, cursor: 'pointer' }}
            whileHover={{ y: -4 }}
            onClick={() => navigate(`/machines/${p.machine_id}`)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{p.machine_id}</div>
              <div className={`badge-${p.risk_level.toLowerCase()}`}>{p.risk_level}</div>
            </div>

            <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>RUL</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{p.rul.toFixed(1)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Health</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{p.health_score.toFixed(1)}%</div>
              </div>
            </div>

            <div className="health-bar" style={{ marginBottom: 16 }}>
              <div
                className="health-bar-fill"
                style={{
                  width: `${p.health_score}%`,
                  background: p.health_score > 60 ? '#10b981' : p.health_score > 30 ? '#f59e0b' : '#ef4444'
                }}
              />
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              {p.risk_level === 'High' ? <AlertCircle size={14} color="#ef4444" /> : <Clock size={14} color="var(--text-muted)" />}
              <span style={{ color: 'var(--text-secondary)' }}>
                {p.risk_level === 'High' ? 'Failure imminent' : `Est. failure: ${p.predicted_failure_date}`}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
