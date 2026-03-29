import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import LiveMonitoring from './pages/LiveMonitoring'
import DataEntry from './pages/DataEntry'
import MachineDetail from './pages/MachineDetail'
import Predictions from './pages/Predictions'
import Tasks from './pages/Tasks'
import AIAssistant from './pages/AIAssistant'
import CostOptimizer from './pages/CostOptimizer'

import WorkCenters from './pages/WorkCenters'
import Calendar from './pages/Calendar'

export default function App() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/monitoring" element={<LiveMonitoring />} />
            <Route path="/log" element={<DataEntry />} />
            <Route path="/machines/:id" element={<MachineDetail />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/cost-optimizer" element={<CostOptimizer />} />
            <Route path="/assistant" element={<AIAssistant />} />
            <Route path="/work-centers" element={<WorkCenters />} />
            <Route path="/calendar" element={<Calendar />} />
            {/* Redirect any other route to dashboard */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
