import React, { useEffect, useState } from 'react'
import { taskApi, workCenterApi, machineApi } from '../api'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Clock, MapPin, User, AlertCircle, Calendar, Plus, Filter, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [machines, setMachines] = useState([])
  const [workCenters, setWorkCenters] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    machine_id: '',
    work_center_id: '',
    priority: 'medium',
    due_date: new Date().toISOString().split('T')[0]
  })

  const fetchData = async () => {
    try {
      const [tData, mData, wcData] = await Promise.all([
        taskApi.getTasks(),
        machineApi.getMachines(),
        workCenterApi.getWorkCenters()
      ])
      setTasks(tData)
      setMachines(mData)
      setWorkCenters(wcData)
      if (mData.length > 0 && !formData.machine_id) {
        setFormData(prev => ({ ...prev, machine_id: mData[0].id }))
      }
      if (wcData.length > 0 && !formData.work_center_id) {
        setFormData(prev => ({ ...prev, work_center_id: wcData[0].id }))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleStatusChange = async (id, status) => {
    await taskApi.updateTask(id, { status })
    fetchData()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await taskApi.createTask(formData)
      setIsModalOpen(false)
      fetchData()
      setFormData({ 
        title: '', description: '', machine_id: machines[0]?.id || '', 
        work_center_id: workCenters[0]?.id || '', priority: 'medium', 
        due_date: new Date().toISOString().split('T')[0] 
      })
    } catch (err) {
      alert('Failed to create work order')
    }
  }

  if (loading) return <div className="spinner" style={{ margin: '100px auto' }} />

  const columns = [
    { id: 'pending', title: 'Open Backlog', color: '#f59e0b', icon: Clock },
    { id: 'in_progress', title: 'Active Processing', color: '#3b82f6', icon: Activity },
    { id: 'done', title: 'Quality Verified', color: '#10b981', icon: CheckCircle },
  ]

  // Mock icons/data for missing fields if not yet synced
  const getTechnician = (id) => id ? `Technician #${id}` : 'Unassigned'
  const getWorkCenterName = (id) => workCenters.find(wc => wc.id === id)?.name || `WC-${id}`

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Work Order Management</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Track and coordinate maintenance operations across all work centers</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={18} />
            <span>Filter</span>
          </button>
          <button 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={18} />
            <span>Create Order</span>
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, alignItems: 'start' }}>
        {columns.map(col => (
          <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
              background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 12,
              borderLeft: `4px solid ${col.color}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: col.color }}><col.icon size={18} /></div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>{col.title}</h3>
              </div>
              <div style={{ background: 'var(--bg-hover)', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                {tasks.filter(t => t.status === col.id).length}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 200 }}>
              <AnimatePresence>
                {tasks.filter(t => t.status === col.id).length > 0 ? (
                  tasks.filter(t => t.status === col.id).map(t => (
                    <motion.div 
                      key={t.id} 
                      layoutId={String(t.id)}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="glass-card" 
                      style={{ padding: 16 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)' }}>UNIT: {t.machine_id}</span>
                        <span className={t.priority === 'critical' ? 'badge-high' : 'badge-medium'} style={{ fontSize: 9 }}>{t.priority}</span>
                      </div>
                      
                      <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>{t.title}</h4>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                        {t.description}
                      </p>
                      
                      <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                          <MapPin size={13} color="var(--accent-blue)" /> 
                          <span>{getWorkCenterName(t.work_center_id)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                          <User size={13} color="var(--accent-cyan)" /> 
                          <span>{getTechnician(t.technician_id)}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={12} /> {t.due_date}
                        </div>
                        
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button 
                            onClick={async () => {
                              if (window.confirm('Delete this work order?')) {
                                await taskApi.deleteTask(t.id)
                                fetchData()
                              }
                            }}
                            className="btn-secondary" 
                            style={{ padding: '6px', color: '#f87171' }}
                          >
                            <Trash2 size={14} />
                          </button>
                          {t.status === 'pending' && (
                            <button onClick={() => handleStatusChange(t.id, 'in_progress')} className="btn-primary" style={{ padding: '6px 12px', fontSize: 11 }}>Begin</button>
                          )}
                          {t.status === 'in_progress' && (
                            <button onClick={() => handleStatusChange(t.id, 'done')} className="btn-primary" style={{ padding: '6px 12px', fontSize: 11, background: 'var(--accent-green)' }}>Complete</button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div style={{ 
                    border: '1px dashed var(--border)', borderRadius: 12, padding: 32, 
                    textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 
                  }}>
                    No orders {col.id.replace('_', ' ')}
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Maintenance Work Order">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label>Title</label>
            <input 
              type="text" 
              required 
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Bearing Replacement"
            />
          </div>
          <div className="input-group">
            <label>Machine / Unit</label>
            <select 
              value={formData.machine_id}
              onChange={e => setFormData({ ...formData, machine_id: e.target.value })}
            >
              {machines.map(m => <option key={m.id} value={m.id}>{m.id} ({m.model_name})</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label>Work Center</label>
              <select 
                value={formData.work_center_id}
                onChange={e => setFormData({ ...formData, work_center_id: parseInt(e.target.value) })}
              >
                {workCenters.map(wc => <option key={wc.id} value={wc.id}>{wc.name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Priority</label>
              <select 
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="input-group">
            <label>Description</label>
            <textarea 
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Details of the maintenance required..."
              rows={3}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>Dispatch Order</button>
        </form>
      </Modal>
    </motion.div>
  )
}

// Mock Activity icon for the columns
function Activity({ size }) {
  return <Clock size={size} />
}
