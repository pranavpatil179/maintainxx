import React, { useState } from 'react'
import { submitLog } from '../api'
import { motion } from 'framer-motion'
import { ClipboardEdit, Sun, Moon } from 'lucide-react'

export default function DataEntry() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    machine_id: '',
    technician: '',
    notes: '',
    s2: '', s3: '', s4: '', s7: '', s8: '', s9: '',
    s11: '', s12: '', s13: '', s14: '', s15: '', s17: '', s20: '', s21: ''
  })

  // Common sensors to map manually (+3 op settings normally)
  const sensors = ['s2', 's3', 's4', 's7', 's8', 's9', 's11', 's12', 's13', 's14', 's15', 's17', 's20', 's21']

  const handleSubmit = async (session) => {
    if (!formData.machine_id) return alert('Machine ID is required')
    setLoading(true)

    // Filter filled sensors
    const sensorObj = {}
    sensors.forEach(s => {
      if (formData[s]) sensorObj[s] = parseFloat(formData[s])
    })

    const payload = {
      machine_id: formData.machine_id,
      session,
      technician: formData.technician,
      notes: formData.notes,
      sensor_snapshot: Object.keys(sensorObj).length > 0 ? sensorObj : null
    }

    try {
      await submitLog(payload)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      setFormData(prev => ({ ...prev, notes: '' })) // keep id/tech, clear notes
    } catch (e) {
      alert(e.response?.data?.detail || 'Error submitting log')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {success && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{
            position: 'fixed', top: 20, right: 20, zIndex: 999,
            background: 'var(--accent-green)', color: '#fff', padding: '12px 24px',
            borderRadius: 8, fontWeight: 600, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}
        >
          ✓ Log submitted successfully! Predictions updated.
        </motion.div>
      )}

      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>Daily Data Entry</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Log twice-daily sensor readouts & maintenance notes</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 300px', gap: 24, alignItems: 'start' }}>
        {/* Form */}
        <div className="glass-card" style={{ padding: 32 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Machine ID *</label>
              <input
                className="form-input"
                placeholder="e.g. FD001-1"
                value={formData.machine_id}
                onChange={e => setFormData({ ...formData, machine_id: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Technician Name</label>
              <input
                className="form-input"
                placeholder="John Doe"
                value={formData.technician}
                onChange={e => setFormData({ ...formData, technician: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Inspection Notes</label>
            <textarea
              className="form-input"
              style={{ minHeight: 100, resize: 'vertical' }}
              placeholder="Any physical degradation, noise anomalies, fluid leaks?"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', marginBottom: 16, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Manual Sensor Overrides (Optional)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {sensors.map(s => (
                <div key={s}>
                  <input
                    className="form-input"
                    style={{ fontSize: 13, padding: '8px 10px' }}
                    placeholder={s.toUpperCase()}
                    value={formData[s]}
                    onChange={e => setFormData({ ...formData, [s]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
            <button
              className="btn-morning"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={() => handleSubmit('morning')}
              disabled={loading}
            >
              <Sun size={18} />
              Submit Morning Log
            </button>
            <button
              className="btn-evening"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={() => handleSubmit('evening')}
              disabled={loading}
            >
              <Moon size={18} />
              Submit Evening Log
            </button>
          </div>
        </div>

        {/* Info panel */}
        <div className="glass-card" style={{ padding: 24, background: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <ClipboardEdit size={20} color="var(--accent-blue)" />
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Logging Instructions</h3>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
            As part of the daily protocol, maintenance teams must enter machine status twice a day:
          </p>
          <ul style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: 20 }}>
            <li><b>Morning Log:</b> Beginning of shift, visual inspection.</li>
            <li><b>Evening Log:</b> End of shift, operational state.</li>
          </ul>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 24, fontStyle: 'italic' }}>
            Note: Submitting a log will trigger the ML engine to immediately re-predict the RUL (Remaining Useful Life) and health score. If sensors are left blank, it relies on historical context.
          </p>
        </div>
      </div>
    </motion.div>
  )
}
