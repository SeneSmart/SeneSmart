import { useState } from 'react'
import {
  Droplets, Thermometer, Waves, FlaskConical, Sprout,
  Wifi, WifiOff, Power, LayoutDashboard, Settings2,
  AlertTriangle, Activity, ChevronRight
} from 'lucide-react'
import './App.css'

const sensors = [
  { name: 'Soil Moisture', value: '68.5', unit: '%', icon: Droplets, color: 'blue' },
  { name: 'Temperature', value: '27.4', unit: '°C', icon: Thermometer, color: 'orange' },
  { name: 'Humidity', value: '72', unit: '%', icon: Waves, color: 'purple' },
  { name: 'Water Level', value: '85', unit: '%', icon: Droplets, color: 'cyan' },
  { name: 'Soil pH', value: '6.5', unit: 'pH', icon: FlaskConical, color: 'green' },
]

function App() {
  const [tab, setTab] = useState('home')
  const [pumpOn, setPumpOn] = useState(false)
  const [online, setOnline] = useState(true)
  const [stale, setStale] = useState(false)

  return (
    <div className="app">
      <header className="topbar">
        <img src="/senesmart-logo.png" alt="SeneSmart" />
        <span className="demo-pill"><span /> DEMO MODE</span>
      </header>

      <main className="content">
        <section className="welcome">
          <div>
            <span className="eyebrow">SMART FARMING</span>
            <h1>{tab === 'home' ? 'Farm Overview' : 'Pump Control'}</h1>
            <p>Your farm, at a glance.</p>
          </div>
          <div className="device-card">
            <div className={`device-icon ${online ? 'connected' : 'disconnected'}`}>
              {online ? <Wifi size={21} /> : <WifiOff size={21} />}
            </div>
            <div>
              <small>SEN-001</small>
              <strong className={online ? 'green-text' : 'red-text'}>
                {online ? 'Online' : 'Offline'}
              </strong>
            </div>
          </div>
        </section>

        {tab === 'home' ? (
          <>
            <section className="quick-status card">
              <div className="status-left">
                <div className={`status-icon ${online ? 'connected' : 'disconnected'}`}>
                  {online ? <Activity size={20} /> : <WifiOff size={20} />}
                </div>
                <div>
                  <strong>{online ? 'Device connected' : 'Device offline'}</strong>
                  <p>{online ? 'Displaying sample sensor data' : 'Connection unavailable'}</p>
                </div>
              </div>
              <button className="icon-button" onClick={() => setOnline(!online)} aria-label="Toggle device status">
                {online ? <WifiOff size={18} /> : <Wifi size={18} />}
              </button>
            </section>

            {stale && (
              <div className="warning">
                <AlertTriangle size={17} />
                Sensor readings may be outdated.
              </div>
            )}

            <div className="section-title">
              <div>
                <h2>Sensor Readings</h2>
                <p>Current field conditions</p>
              </div>
              <span className="sample-label">SAMPLE DATA</span>
            </div>

            <section className="sensor-grid">
              {sensors.map((sensor) => {
                const Icon = sensor.icon
                return (
                  <article className="sensor-card card" key={sensor.name}>
                    <div className={`sensor-icon ${sensor.color}`}>
                      <Icon size={23} strokeWidth={2} />
                    </div>
                    <p>{sensor.name}</p>
                    <div className="sensor-value">
                      {sensor.value}<span>{sensor.unit}</span>
                    </div>
                    <div className="sensor-footer">
                      <span className="reading-dot" />
                      Demo reading
                    </div>
                  </article>
                )
              })}
            </section>

            <div className="section-title pump-title">
              <div>
                <h2>Irrigation</h2>
                <p>Water pump management</p>
              </div>
              <button className="text-button" onClick={() => setTab('pump')}>
                Manage <ChevronRight size={16} />
              </button>
            </div>

            <section className="pump-card card">
              <div className={`pump-icon ${pumpOn ? 'pump-active' : ''}`}>
                <Power size={25} />
              </div>
              <div className="pump-details">
                <strong>Water Pump</strong>
                <span className={pumpOn ? 'green-text' : 'muted'}>
                  {pumpOn ? 'Running' : 'Stopped'}
                </span>
              </div>
              <button
                className={`switch ${pumpOn ? 'switch-on' : ''}`}
                onClick={() => setPumpOn(!pumpOn)}
                aria-label="Toggle pump"
              >
                <span />
              </button>
            </section>
          </>
        ) : (
          <section className="pump-page">
            <div className="pump-control-card card">
              <div className={`big-pump-icon ${pumpOn ? 'pump-active' : ''}`}>
                <Power size={38} />
              </div>
              <span className="eyebrow">IRRIGATION SYSTEM</span>
              <h2>Water Pump</h2>
              <p className="muted">Device SEN-001</p>

              <div className={`pump-status ${pumpOn ? 'status-running' : ''}`}>
                <span /> {pumpOn ? 'PUMP RUNNING' : 'PUMP STOPPED'}
              </div>

              <button
                className={`control-button ${pumpOn ? 'button-stop' : 'button-start'}`}
                onClick={() => setPumpOn(!pumpOn)}
              >
                <Power size={19} />
                {pumpOn ? 'Turn Pump OFF' : 'Turn Pump ON'}
              </button>
              <p className="demo-note">Demo control only — hardware is not connected.</p>
            </div>

            <section className="card device-settings">
              <div className="settings-icon"><Settings2 size={21} /></div>
              <div>
                <strong>Device connection</strong>
                <p>{online ? 'SEN-001 is online' : 'SEN-001 is offline'}</p>
              </div>
              <button className="icon-button" onClick={() => setOnline(!online)}>
                {online ? <WifiOff size={18} /> : <Wifi size={18} />}
              </button>
            </section>
          </section>
        )}

        <section className="developer-tools">
          <button onClick={() => setStale(!stale)}>
            <AlertTriangle size={15} />
            {stale ? 'Clear stale warning' : 'Test stale readings'}
          </button>
        </section>
      </main>

      <nav className="bottom-nav">
        <button className={tab === 'home' ? 'nav-active' : ''} onClick={() => setTab('home')}>
          <LayoutDashboard size={21} />
          <span>Overview</span>
        </button>
        <button className={tab === 'pump' ? 'nav-active' : ''} onClick={() => setTab('pump')}>
          <Power size={21} />
          <span>Pump</span>
        </button>
      </nav>
    </div>
  )
}

export default App
