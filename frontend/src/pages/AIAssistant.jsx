import React, { useState, useRef, useEffect } from 'react'
import { queryAssistant } from '../api'
import { motion } from 'framer-motion'
import { Bot, Send, User, Sparkles } from 'lucide-react'

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello! I am MaintainXx AI. I have real-time access to the prediction ledger and maintenance tasks. How can I help you manage the fleet today?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e, forcedQuery = null) => {
    e?.preventDefault()
    const query = forcedQuery || input.trim()
    if (!query) return

    setMessages(prev => [...prev, { role: 'user', text: query }])
    setInput('')
    setLoading(true)

    try {
      const res = await queryAssistant({ query })
      setMessages(prev => [...prev, {
        role: 'ai',
        text: res.answer,
        suggestions: res.suggested_actions,
        machines: res.machines_referenced
      }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I encountered an error connecting to the intelligence engine.' }])
    } finally {
      setLoading(false)
    }
  }

  const examples = [
    "Which machines are at high risk?",
    "What should be maintained today?",
    "What's the overall fleet health?",
    "Which machines will fail soonest?",
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', padding: 12, borderRadius: 12 }}>
          <Sparkles color="#fff" size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px' }}>MaintainXx AI Assistant</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Natural language interaction with your predictive maintenance data</p>
        </div>
      </header>

      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Chat window */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: 12, alignItems: 'flex-start' }}
            >
              <div style={{ background: m.role === 'user' ? '#3b82f6' : 'var(--bg-hover)', padding: 8, borderRadius: '50%', border: '1px solid var(--border-light)' }}>
                {m.role === 'user' ? <User size={16} color="#fff" /> : <Bot size={16} color="var(--accent-blue)" />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: '80%', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div className={m.role === 'user' ? 'chat-user' : 'chat-ai'} dangerouslySetInnerHTML={{ __html: m.text.replace(/\ng/, '<br/>') }} />
                
                {m.machines?.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {m.machines.map(mac => (
                      <a key={mac} href={`/machines/${mac}`} style={{ fontSize: 11, background: 'var(--bg-primary)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: 4, color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                        🔗 {mac}
                      </a>
                    ))}
                  </div>
                )}
                
                {m.suggestions?.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {m.suggestions.map((s, idx) => (
                      <div key={idx} style={{ fontSize: 11, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '4px 8px', borderRadius: 12 }}>
                        💡 {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ background: 'var(--bg-hover)', padding: 8, borderRadius: '50%' }}><Bot size={16} color="var(--accent-blue)" /></div>
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Example queries */}
        {messages.length === 1 && (
          <div style={{ padding: '0 24px 16px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {examples.map(ex => (
              <button key={ex} onClick={(e) => handleSend(e, ex)} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 16, padding: '8px 16px', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => {e.target.style.borderColor='var(--accent-blue)'; e.target.style.color='var(--text-primary)'}} onMouseLeave={e => {e.target.style.borderColor='var(--border)'; e.target.style.color='var(--text-secondary)'}}>
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Input box */}
        <div style={{ padding: 20, borderTop: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ flex: 1, padding: '14px 20px', borderRadius: 24, fontSize: 15 }}
              placeholder="Ask me anything about the fleet..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()} style={{ background: input.trim() ? 'var(--accent-blue)' : 'var(--bg-hover)', color: '#fff', border: 'none', borderRadius: '50%', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default', transition: 'background 0.2s' }}>
              <Send size={20} style={{ marginLeft: input.trim() ? 4 : 0 }} />
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  )
}
