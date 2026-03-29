import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Activity, Archive, Clock, ArrowLeft, Plus, X, Send, Sun, Moon, Cpu, Factory, ClipboardList, Trash2, Calendar as CalendarIcon } from 'lucide-react'
import { getMachine, getMachineHistory, getMachinePredictions, getMachineLogs, submitLog, taskApi } from '../api'

export default function MachineDetail() {
  const { id } = useParams()
  const [machine, setMachine] = useState(null)
  const [history, setHistory] = useState([])
  const [predictions, setPredictions] = useState([])
  const [tasks, setTasks] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showLogForm, setShowLogForm] = useState(false)
  const [newLog, setNewLog] = useState({ notes: '', technician: '', session: 'morning' })

  const fetchMachineData = () => {
    Promise.all([
      getMachine(id),
      getMachineHistory(id, 100),
      getMachinePredictions(id),
      getMachineLogs(id),
      taskApi.getTasks()
    ])
      .then(([m, h, p, l, t]) => {
        setMachine(m)
        setHistory(h.reverse())
        setPredictions(p.reverse())
        setLogs(l)
        setTasks(t.filter(task => task.machine_id === id))
        setLoading(false)
      })
      .catch(e => {
        console.error(e)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchMachineData()
    const interval = setInterval(fetchMachineData, 3000)
    return () => clearInterval(interval)
  }, [id])

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return
    try {
      await taskApi.deleteTask(taskId)
      fetchMachineData()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div className="spinner" style={{ margin: '100px auto' }} />
  if (!machine) return <div style={{ textAlign: 'center', marginTop: 100 }}>Machine not found.</div>

  const handleLogSubmit = async (session) => {
    if (!newLog.technician) return alert('Technician name is required')
    setSubmitting(true)
    try {
      await submitLog({
        machine_id: id,
        session,
        technician: newLog.technician,
        notes: newLog.notes,
        sensor_snapshot: null
      })
      fetchMachineData()
      setShowLogForm(false)
      setNewLog({ notes: '', technician: newLog.technician, session: 'morning' })
    } catch (e) {
      alert('Error submitting log')
    } finally {
      setSubmitting(false)
    }
  }

  const currentPred = predictions[predictions.length - 1] || { rul: 0, health_score: 0, risk_level: 'Unknown' }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 24, fontSize: 14, fontWeight: 500 }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px' }}>{machine.serial_number || machine.id}</h1>
            <div className={`badge-${currentPred.risk_level.toLowerCase()}`}>{currentPred.risk_level}</div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Cpu size={14} /> {machine.model_name || 'Generic Engine'}</span>
            <span style={{ opacity: 0.5 }}>|</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Archive size={14} /> Group: {machine.category_id || 'Alpha'}</span>
            <span style={{ opacity: 0.5 }}>|</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Factory size={14} /> {machine.company || 'Skyline Dynamics'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          <div className="glass-card" style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 140, borderTop: '2px solid var(--accent-blue)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current RUL</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{currentPred.rul.toFixed(1)}</div>
          </div>
          <div className="glass-card" style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 140, borderTop: '2px solid var(--accent-green)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Health Score</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: currentPred.health_score > 60 ? '#10b981' : currentPred.health_score > 30 ? '#f59e0b' : '#ef4444' }}>
              {currentPred.health_score.toFixed(1)}%
            </div>
          </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px 280px', gap: 24, marginBottom: 32 }}>
        {/* Left Col: Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Health over time */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>RUL Prediction History</h3>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={predictions}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="predicted_at" tickFormatter={t => new Date(t).toLocaleDateString()} tick={{ fill: 'var(--text-muted)' }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <Line type="stepAfter" dataKey="rul" stroke="#8b5cf6" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sensor trends */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Key Sensor Readings (Last 100 cycles)</h3>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="cycle" tick={{ fill: 'var(--text-muted)' }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  {/* Just plot a few dynamic sensors for the MVP */}
                  <Line type="monotone" dataKey="s2" stroke="#3b82f6" strokeWidth={2} dot={false} name="Sensor 2" />
                  <Line type="monotone" dataKey="s3" stroke="#10b981" strokeWidth={2} dot={false} name="Sensor 3" />
                  <Line type="monotone" dataKey="s4" stroke="#f59e0b" strokeWidth={2} dot={false} name="Sensor 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Hybrid Intelligence & Scheduled Tasks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Hybrid Diagnostics Panel */}
          <div className="glass-card" style={{ padding: 24, borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <Activity size={18} color="#8b5cf6" />
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Hybrid Diagnostics</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Engineer Health Assessment</label>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#8b5cf6' }}>{machine.manual_health_score ?? (predictions[0]?.health_score || 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={machine.manual_health_score ?? (predictions[0]?.health_score || 100)}
                  onChange={async (e) => {
                    const val = parseInt(e.target.value);
                    setMachine({...machine, manual_health_score: val});
                    await machineApi.updateMachine(id, { manual_health_score: val });
                  }}
                  style={{ width: '100%', accentColor: '#8b5cf6', cursor: 'pointer' }}
                />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Slide to override AI prediction with expert manual observation.
                </p>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Engineer Notes</label>
                <textarea 
                  placeholder="Enter physical observations..."
                  value={machine.observation_notes || ''}
                  onChange={e => setMachine({...machine, observation_notes: e.target.value})}
                  onBlur={async () => {
                    await machineApi.updateMachine(id, { observation_notes: machine.observation_notes });
                  }}
                  style={{ 
                    width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', 
                    borderRadius: 8, padding: 10, fontSize: 12, color: 'var(--text-primary)',
                    minHeight: 60, outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: 24, alignSelf: 'start', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <ClipboardList size={18} color="var(--accent-amber)" />
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Scheduled Tasks</h3>
            </div>
            
            {tasks.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No pending tasks.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tasks.map(task => (
                  <div key={task.id} style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className={task.priority === 'critical' ? 'badge-high' : 'badge-medium'} style={{ fontSize: 9 }}>{task.priority}</span>
                      <button 
                        onClick={() => handleDeleteTask(task.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{task.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CalendarIcon size={12} /> {task.scheduled_date || task.due_date}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Manual Logs Column */}
        <div className="glass-card" style={{ padding: 24, alignSelf: 'start', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Archive size={18} color="var(--accent-blue)" />
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Daily Logs</h3>
            </div>
            <button 
              onClick={() => setShowLogForm(!showLogForm)}
              style={{ background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              {showLogForm ? <X size={16} /> : <Plus size={16} />}
            </button>
          </div>

          <AnimatePresence>
            {showLogForm && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden', marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 24 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input 
                    placeholder="Technician Name"
                    className="form-input"
                    value={newLog.technician}
                    onChange={e => setNewLog({...newLog, technician: e.target.value})}
                    style={{ fontSize: 13, padding: '10px' }}
                  />
                  <textarea 
                    placeholder="Inspection findings & notes..."
                    className="form-input"
                    value={newLog.notes}
                    onChange={e => setNewLog({...newLog, notes: e.target.value})}
                    style={{ fontSize: 13, minHeight: 80, padding: '10px', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button 
                      className="btn-morning" 
                      onClick={() => handleLogSubmit('morning')}
                      disabled={submitting}
                      style={{ flex: 1, padding: '8px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Sun size={14} /> Morning
                    </button>
                    <button 
                      className="btn-evening" 
                      onClick={() => handleLogSubmit('evening')}
                      disabled={submitting}
                      style={{ flex: 1, padding: '8px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Moon size={14} /> Evening
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No logs recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {logs.map(log => (
                <div key={log.id} style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: 12, border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: log.session === 'morning' ? '#f59e0b' : '#8b5cf6', textTransform: 'uppercase' }}>
                      {log.session} Log
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Technician: <b>{log.technician}</b>
                  </div>
                  {log.notes && (
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-card)', padding: 10, borderRadius: 6, fontStyle: 'italic' }}>
                      "{log.notes}"
                    </div>
                  )}
                  {log.sensor_snapshot && Object.keys(JSON.parse(log.sensor_snapshot)).length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--accent-blue)', marginTop: 8, fontWeight: 500 }}>
                      [Manual Sensor Override Included]
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
