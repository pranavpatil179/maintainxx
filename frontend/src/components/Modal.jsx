import React from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20
    }}>
      <div className="glass-card" style={{
        width: '100%', maxWidth: 500, padding: 32, position: 'relative',
        animation: 'modalSlideUp 0.3s ease-out'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <button 
            onClick={onClose}
            style={{ 
              background: 'none', border: 'none', color: 'var(--text-muted)', 
              cursor: 'pointer', padding: 4 
            }}
          >
            <X size={24} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
