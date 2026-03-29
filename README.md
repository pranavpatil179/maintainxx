# MaintainXx: Predictive Maintenance Intelligence System

MaintainXx is a powerful AI platform that transforms raw machine sensor data into predictive insights, maintenance scheduling, and cost-saving recommendations. It is specifically designed to leverage the **NASA CMAPSS Turbofan Jet Engine Dataset** for realistic industrial predictive modeling.

## 🚀 Key Features

- **NASA Dataset Integration**: Automatically parses and trains on real sensor data (FD001 dataset).
- **AI-Powered RUL Prediction**: Prevents unplanned failures by predicting Remaining Useful Life (RUL).
- **Dynamic Cost Optimizer**: Probabilistic model that optimizes maintenance timing to minimize total operational costs ($Cp$ vs. $Cf$).
- **Live Monitoring Dashboard**: Real-time visualization of fleet health, risk levels, and sensor trends.
- **Automated Workflow**: Generates maintenance tasks and daily logs based on AI-detected risks.
- **Hybrid Intelligence**: Blends AI sensor analytics with manual technician observations for accurate health scoring.

## 🛠️ Tech Stack

- **Backend**: FastAPI, SQLAlchemy (SQLite), Scikit-Learn (Gradient Boosting), Pandas.
- **Frontend**: React, Tailwind CSS, Lucide icons, Framer Motion, Recharts.
- **Data Source**: NASA CMAPSS (CMaps) dataset.

## 🏃 Getting Started

### 1. Prerequisites
- Python 3.10+
- Node.js 18+

### 2. Setup Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
python main.py
```
*The system will automatically detect the **CMaps** dataset in the parent directory and seed the database with real machine data on the first run.*

### 3. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

## 📈 Cost Optimization Logic
The system uses a probabilistic comparison model:
- **P(fail)**: Exponential probability of failure calculated based on current RUL.
- **Expected Failure Cost**: $P(fail) \times Cf$ (unplanned downtime cost).
- **Decision Rule**: If $Expected Failure Cost > Cp$ (planned repair cost), the system recommends **Repair Now**.

---
*Developed for Industrial AI demonstrations and jury presentations.*
