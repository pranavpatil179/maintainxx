import React, { useEffect, useState } from 'react'
import { workCenterApi } from '../api'
import { Factory, Plus, Zap, Percent, Clock, Users } from 'lucide-react'
import Modal from '../components/Modal'

export default function WorkCenters() {
  const [centers, setCenters] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    tag: 'Production',
    capacity: 100,
    oee_target: 85,
    cost_per_hour: 50
  })

  useEffect(() => {
    loadCenters()
  }, [])

  const loadCenters = async () => {
    try {
      const data = await workCenterApi.getWorkCenters()
      setCenters(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await workCenterApi.createWorkCenter(formData)
      setIsModalOpen(false)
      loadCenters()
      setFormData({ name: '', code: '', tag: 'Production', capacity: 100, oee_target: 85, cost_per_hour: 50 })
    } catch (err) {
      alert('Failed to create work center')
    }
  }

  if (loading) return <div className="spinner" style={{ margin: '100px auto' }} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Work Centers</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage production lines and maintenance facility capacity</p>
        </div>
        <button 
          className="btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={18} />
          <span>New Work Center</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
        {centers.length > 0 ? (
          centers.map(wc => (
            <div key={wc.id} className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ 
                    width: 44, height: 44, borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)'
                  }}>
                    <Factory size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{wc.name}</h3>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>CODE: {wc.code}</span>
                  </div>
                </div>
                <div className="pulse-dot green" title="Active" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                    <Zap size={12} /> OEE TARGET
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-green)' }}>{wc.oee_target}%</div>
                </div>
                <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                    <Clock size={12} /> CAPACITY
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{wc.capacity}%</div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  <span>Real-time Efficiency</span>
                  <span style={{ fontWeight: 600 }}>{(wc.efficiency * 100).toFixed(1)}%</span>
                </div>
                <div className="health-bar">
                  <div className="health-bar-fill" style={{ width: `${wc.efficiency * 100}%`, backgroundColor: 'var(--accent-blue)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: 10, background: 'var(--bg-hover)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 500 }}>
                  Hourly Rate: ${wc.cost_per_hour}
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: 10, background: 'var(--bg-hover)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 500 }}>
                  Tag: {wc.tag}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-card" style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Factory size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
            <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>No Work Centers Registered</p>
            <p style={{ fontSize: 14 }}>Create your first production line or maintenance bay to get started.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Work Center">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label>Name</label>
            <input 
              type="text" 
              required 
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Assembly Line A"
            />
          </div>
          <div className="input-group">
            <label>Code</label>
            <input 
              type="text" 
              required 
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g. AL-01"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label>Tag</label>
              <select 
                value={formData.tag}
                onChange={e => setFormData({ ...formData, tag: e.target.value })}
              >
                <option value="Production">Production</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Inspection">Inspection</option>
                <option value="Packaging">Packaging</option>
              </select>
            </div>
            <div className="input-group">
              <label>Cost / Hour ($)</label>
              <input 
                type="number" 
                value={formData.cost_per_hour}
                onChange={e => setFormData({ ...formData, cost_per_hour: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>Register Work Center</button>
        </form>
      </Modal>
    </div>
  )
}
