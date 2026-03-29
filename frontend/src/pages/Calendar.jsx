import React, { useEffect, useState } from 'react'
import { taskApi } from '../api'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin, User, Plus, Check, X, Trash2 } from 'lucide-react'

export default function CalendarView() {
  const [tasks, setTasks] = useState([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', machine_id: '', priority: 'medium', scheduled_date: '' })

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      const data = await taskApi.getTasks()
      setTasks(data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    try {
      await taskApi.createTask(newTask)
      setIsModalOpen(false)
      loadTasks()
      setNewTask({ title: '', machine_id: '', priority: 'medium', scheduled_date: '' })
    } catch (err) {
      alert('Error creating task: ' + err.message)
    }
  }

  const handleDeleteTask = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this task?')) return
    try {
      await taskApi.deleteTask(id)
      loadTasks()
    } catch (err) {
      console.error(err)
    }
  }

  const toggleTaskComplete = async (task) => {
    try {
      const newStatus = task.status === 'resolved' ? 'open' : 'resolved'
      await taskApi.updateTask(task.id, { status: newStatus })
      loadTasks()
    } catch (err) {
      console.error(err)
    }
  }

  // Basic calendar logic
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay()

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const days = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)

  const monthName = currentMonth.toLocaleString('default', { month: 'long' })

  // Match tasks by date
  const getTasksForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return tasks.filter(t => t.scheduled_date === dateStr)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Maintenance Calendar</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Schedule and coordinate upcoming maintenance operations</p>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-card)', padding: '4px 8px', borderRadius: 10, border: '1px solid var(--border)' }}>
            <button className="btn-icon" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ fontSize: 14, fontWeight: 700, minWidth: 120, textAlign: 'center' }}>
              {monthName} {year}
            </div>
            <button className="btn-icon" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>
              <ChevronRight size={16} />
            </button>
          </div>
          <button 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={18} /> Schedule Task
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 1, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
            <div key={d} style={{ padding: '16px', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '0.1em' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 700 }}>
          {Array(firstDay).fill(null).map((_, i) => (
            <div key={`empty-${i}`} style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }} />
          ))}
          {Array(days).fill(null).map((_, i) => {
            const day = i + 1
            const dayTasks = getTasksForDay(day)
            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()

            return (
              <div 
                key={day} 
                style={{ 
                  border: '1px solid var(--border)', 
                  background: isToday ? 'rgba(59, 130, 246, 0.03)' : 'var(--bg-card)', 
                  padding: 12, 
                  minHeight: 140,
                  transition: 'all 0.2s ease'
                }}
                className="calendar-day"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ 
                    fontSize: 13, fontWeight: isToday ? 800 : 600, 
                    color: isToday ? 'var(--accent-blue)' : 'var(--text-muted)',
                    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isToday ? 'var(--accent-blue)' : 'transparent', 
                    color: isToday ? '#fff' : 'var(--text-muted)',
                    borderRadius: 8
                  }}>
                    {day}
                  </span>
                  <button 
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                    onClick={() => {
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      setNewTask({ ...newTask, scheduled_date: dateStr })
                      setIsModalOpen(true)
                    }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {dayTasks.map(t => (
                    <div 
                      key={t.id} 
                      onClick={() => toggleTaskComplete(t)}
                      style={{ 
                        fontSize: 10, padding: '6px 10px', borderRadius: 8, 
                        background: t.status === 'resolved' ? 'rgba(16, 185, 129, 0.1)' : t.priority === 'critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: t.status === 'resolved' ? '#10b981' : t.priority === 'critical' ? '#f87171' : '#60a5fa',
                        border: `1px solid ${t.status === 'resolved' ? 'rgba(16, 185, 129, 0.2)' : t.priority === 'critical' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`,
                        fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                        textDecoration: t.status === 'resolved' ? 'line-through' : 'none',
                        opacity: t.status === 'resolved' ? 0.6 : 1,
                        position: 'relative',
                        justifyContent: 'space-between'
                      }}
                      className="calendar-task"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.status === 'resolved' ? <Check size={10} /> : <Clock size={10} />}
                        {t.title}
                      </div>
                      <button 
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', height: 12, width: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}
                        onClick={(e) => handleDeleteTask(e, t.id)}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="glass-card" style={{ width: 400, padding: 32, position: 'relative' }}>
            <button 
              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24, color: 'var(--text-primary)' }}>Schedule Operation</h2>
            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Task Title</label>
                <input 
                  type="text" required value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  placeholder="e.g. Bearing Replacement"
                  style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Machine ID</label>
                  <input 
                    type="text" required value={newTask.machine_id}
                    onChange={e => setNewTask({...newTask, machine_id: e.target.value})}
                    placeholder="FD001-1"
                    style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Date</label>
                  <input 
                    type="date" required value={newTask.scheduled_date}
                    onChange={e => setNewTask({...newTask, scheduled_date: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Priority Level</label>
                <select 
                  value={newTask.priority}
                  onChange={e => setNewTask({...newTask, priority: e.target.value})}
                  style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', color: 'var(--text-primary)' }}
                >
                  <option value="low">Low (Routine)</option>
                  <option value="medium">Medium (Advisory)</option>
                  <option value="critical">Critical (Imminent)</option>
                </select>
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: 8, padding: 14 }}>Create Schedule</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
