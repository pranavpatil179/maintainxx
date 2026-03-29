import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Activity, ClipboardList, Cpu,
  CheckSquare, Bot, Zap, DollarSign,
  Box, Factory, Calendar as CalendarIcon
} from 'lucide-react'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/monitoring', icon: Activity, label: 'Live Monitoring' },
  { to: '/log', icon: ClipboardList, label: 'Data Entry' },
  { to: '/predictions', icon: Cpu, label: 'Predictions' },
  { to: '/tasks', icon: CheckSquare, label: 'Work Orders' },
  { to: '/calendar', icon: CalendarIcon, label: 'Maintenance Calendar' },
  { to: '/work-centers', icon: Factory, label: 'Work Centers' },
  { to: '/cost-optimizer', icon: DollarSign, label: 'Cost Optimizer' },
  { to: '/assistant', icon: Bot, label: 'AI Assistant' },
]

export default function Sidebar() {
  return (
    <div className="sidebar">
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              MaintainXx
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Predictive AI</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '8px 20px 4px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          Main Menu
        </div>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Powered by</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>NASA CMAPSS Dataset</div>
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 8, padding: '6px 10px'
        }}>
          <span className="pulse-dot green" />
          <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>System Online</span>
        </div>
      </div>
    </div>
  )
}
