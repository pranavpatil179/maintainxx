import React, { useEffect, useState } from 'react'
import { getPredictions } from '../api'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function Predictions() {
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  useEffect(() => {
    const fetchPreds = () => {
      setIsFetching(true)
      getPredictions().then(data => {
        setPredictions(data.sort((a, b) => a.rul - b.rul))
        setLoading(false)
        setLastUpdated(new Date())
        setTimeout(() => setIsFetching(false), 500)
      })
    }
    fetchPreds()
    const interval = setInterval(fetchPreds, 2000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div className="spinner" style={{ margin: '100px auto' }} />

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>Fleet Predictions</h1>
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
          <p style={{ color: 'var(--text-secondary)' }}>Complete ledger of all machines sorted by imminent failure</p>
        </div>
        <a href="http://127.0.0.1:8000/api/export/csv" target="_blank" rel="noreferrer" className="btn-secondary" style={{ textDecoration: 'none' }}>
          Download CSV
        </a>
      </header>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Machine ID</th>
              <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Risk Level</th>
              <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>RUL (Cycles)</th>
              <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Health Score</th>
              <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Est. Failure Date</th>
              <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((p, i) => (
              <tr key={p.machine_id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.machine_id}</td>
                <td style={{ padding: '16px 20px' }}>
                  <span className={`badge-${p.risk_level.toLowerCase()}`}>{p.risk_level}</span>
                </td>
                <td style={{ padding: '16px 20px', fontWeight: 700 }}>
                  <span style={{ color: p.rul < 50 ? '#ef4444' : p.rul < 150 ? '#f59e0b' : '#3b82f6' }}>{p.rul.toFixed(1)}</span>
                </td>
                <td style={{ padding: '16px 20px', fontWeight: 600 }}>{p.health_score.toFixed(1)}%</td>
                <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: 14 }}>{p.predicted_failure_date}</td>
                <td style={{ padding: '16px 20px' }}>
                  <Link to={`/machines/${p.machine_id}`} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, textDecoration: 'none' }}>
                    View Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
