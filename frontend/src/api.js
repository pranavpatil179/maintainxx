import axios from 'axios'

const API_BASE_URL = 'https://maintainxx-api-demo.loca.lt/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

// Add Auth Interceptor
api.interceptors.request.use((config) => {
  config.headers['Bypass-Tunnel-Reminder'] = 'true'
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authApi = {
  login: (data) => api.post('/users/login', data, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).then(r => r.data),
  register: (data) => api.post('/users/register', data).then(r => r.data),
  getMe: () => api.get('/users/me').then(r => r.data)
}

export const machineApi = {
  getMachines: () => api.get('/machines/').then(r => r.data),
  getMachine: (id) => api.get(`/machines/${encodeURIComponent(id)}`).then(r => r.data),
  getMachineHistory: (id, limit = 100) => api.get(`/machines/${encodeURIComponent(id)}/history?limit=${limit}`).then(r => r.data),
  getMachinePredictions: (id) => api.get(`/machines/${encodeURIComponent(id)}/predictions`).then(r => r.data),
  updateMachine: (id, data) => api.patch(`/machines/${encodeURIComponent(id)}`, data).then(r => r.data)
}

export const predictionApi = {
  getSummary: () => api.get('/predictions/summary').then(r => r.data),
  getLatest: () => api.get('/predictions/').then(r => r.data),
  getHealthTrend: () => api.get('/predictions/health-trend').then(r => r.data)
}

export const logApi = {
  getLogs: (machineId) => api.get(`/logs/${encodeURIComponent(machineId)}`).then(r => r.data),
  createLog: (data) => api.post('/logs/', data).then(r => r.data)
}

export const taskApi = {
  getTasks: (status) => api.get('/tasks/' + (status ? `?status=${status}` : '')).then(r => r.data),
  updateTask: (id, data) => api.patch(`/tasks/${id}`, data).then(r => r.data),
  createTask: (data) => api.post('/tasks/', data).then(r => r.data),
  deleteTask: (id) => api.delete(`/tasks/${id}`).then(r => r.data)
}


export const categoryApi = {
  getCategories: () => api.get('/categories/').then(r => r.data),
  createCategory: (data) => api.post('/categories/', data).then(r => r.data)
}

export const workCenterApi = {
  getWorkCenters: () => api.get('/work-centers/').then(r => r.data),
  createWorkCenter: (data) => api.post('/work-centers/', data).then(r => r.data)
}

export const assistantApi = {
  query: (data) => api.post('/assistant/query', data).then(r => r.data)
}

// Backward Compatibility Exports
export const getMachines = machineApi.getMachines
export const getMachine = machineApi.getMachine
export const getMachineHistory = machineApi.getMachineHistory
export const getMachinePredictions = machineApi.getMachinePredictions
export const getPredictions = predictionApi.getLatest
export const getPredictionsSummary = predictionApi.getSummary
export const getHealthTrend = predictionApi.getHealthTrend
export const getMachineLogs = logApi.getLogs
export const submitLog = logApi.createLog
export const getTasks = taskApi.getTasks
export const queryAssistant = assistantApi.query

export default api
