import { useEffect, useState } from 'react'
import './App.css'

const SENSOR_CONFIG = [
  { name: 'Water Level', key: 'water', symbol: '💧', unit: '%', type: 'water', percent: v => v },
  { name: 'Oxygen Pressure', key: 'pressure', symbol: '🫧', unit: 'bar', type: 'oxygen', percent: v => v * 25 },
  { name: 'Air Quality', key: 'air', symbol: '🍃', unit: 'AQI', type: 'air', percent: v => 100 - v / 2 },
  { name: 'Temperature', key: 'temperature', symbol: '🌡️', unit: '°C', type: 'temperature', percent: v => v * 2 },
  { name: 'Humidity', key: 'humidity', symbol: '💦', unit: '%', type: 'humidity', percent: v => v }
]

function getStatus(value, type) {
  if (value === null) return 'waiting'
  if (type === 'water') {
    if (value < 20) return 'danger'
    if (value < 40) return 'warning'
  }
  if (type === 'oxygen') {
    if (value < 1) return 'danger'
    if (value < 2) return 'warning'
  }
  if (type === 'air') {
    if (value > 150) return 'danger'
    if (value > 100) return 'warning'
  }
  if (type === 'temperature') {
    if (value > 38 || value < 10) return 'danger'
    if (value > 32 || value < 18) return 'warning'
  }
  if (type === 'humidity' && (value < 30 || value > 85)) return 'warning'
  return 'good'
}

function App() {
  const [connected, setConnected] = useState(false)
  const [sensors, setSensors] = useState({
    water: null,
    pressure: null,
    air: null,
    temperature: null,
    humidity: null
  })

  useEffect(() => {
    let socket
    let retry
    let stopped = false

    function update(data) {
      if (!data?.sensors) return
      const s = data.sensors

      setSensors(previous => ({
        ...previous,
        ...(typeof s.water_level === 'number' && { water: s.water_level }),
        ...(typeof s.oxygen_pressure === 'number' && { pressure: s.oxygen_pressure }),
        ...(typeof s.air_quality === 'number' && { air: s.air_quality }),
        ...(typeof s.temperature === 'number' && { temperature: s.temperature }),
        ...(typeof s.humidity === 'number' && { humidity: s.humidity })
      }))
    }

    function connect() {
      if (stopped) return
      socket = new WebSocket('ws://localhost:9001')

      socket.onmessage = event => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'initial') {
            setConnected(msg.connected_devices?.includes('SEN-001') || false)
            const device = msg.devices?.find(d => d.device_id === 'SEN-001')
            if (device) update(device)
          }

          if (msg.type === 'device_status' && msg.device_id === 'SEN-001') {
            setConnected(msg.status === 'online')
          }

          if (msg.type === 'reading' && msg.device_id === 'SEN-001') {
            update(msg)
            setConnected(true)
          }
        } catch (error) {
          console.error('Sensor message error:', error)
        }
      }

      socket.onclose = () => {
        setConnected(false)
        if (!stopped) retry = setTimeout(connect, 3000)
      }

      socket.onerror = () => socket?.close()
    }

    connect()

    return () => {
      stopped = true
      clearTimeout(retry)
      socket?.close()
    }
  }, [])

  const allReady = Object.values(sensors).every(value => value !== null)

  return (
    <main className="farmer-app">
      <header className="app-header">
        <img className="app-logo" src="/senesmart-logo.png" alt="SeneSmart" />
        <div className={`connection ${connected ? 'connected' : ''}`}>
          <span className="connection-dot" />
          {connected ? 'Online' : 'Offline'}
        </div>
      </header>

      <section className={`main-status ${connected ? 'active' : ''}`}>
        <div>
          <p className="eyebrow">SMART FARM MONITORING</p>
          <h1>{connected ? 'Farm is connected' : 'Waiting for device'}</h1>
          <p>
            {connected
              ? 'Your farm sensors are reporting live data.'
              : 'Connect your SeneSmart device to view readings.'}
          </p>
        </div>
        <span className="status-icon">{connected ? '🌱' : '📡'}</span>
      </section>

      <section className="dashboard-heading">
        <div>
          <h2>Farm Overview</h2>
          <p>Live environmental readings</p>
        </div>
        <span className="device-label">SEN-001</span>
      </section>

      <section className="sensors">
        {SENSOR_CONFIG.map(sensor => {
          const value = sensors[sensor.key]
          const status = getStatus(value, sensor.type)
          const percent = value === null
            ? 0
            : Math.max(0, Math.min(100, sensor.percent(value)))

          return (
            <article className={`sensor-card ${status}`} key={sensor.key}>
              <div className="sensor-top">
                <span className="sensor-symbol">{sensor.symbol}</span>
                <span className={`sensor-indicator ${status}`} />
              </div>
              <p className="sensor-name">{sensor.name}</p>
              <div className="sensor-value">
                {value === null ? '--' : Number(value).toFixed(1)}
                {value !== null && <small>{sensor.unit}</small>}
              </div>
              <div className="meter">
                <div className="meter-fill" style={{ width: `${percent}%` }} />
              </div>
              <p className={`sensor-status ${status}`}>
                {status === 'waiting' ? 'Waiting for data'
                  : status === 'good' ? 'Normal'
                  : status === 'warning' ? 'Needs attention'
                  : 'Critical'}
              </p>
            </article>
          )
        })}
      </section>

      <section className="farm-summary">
        <span className="summary-icon">📊</span>
        <div>
          <h3>Sensor summary</h3>
          <p>
            {allReady
              ? 'All five sensor readings have been received.'
              : 'Waiting for all sensor readings.'}
          </p>
        </div>
      </section>

      <footer className="app-footer">
        <span>SeneSmart</span>
        <span>Smart Agriculture System</span>
      </footer>
    </main>
  )
}

export default App
