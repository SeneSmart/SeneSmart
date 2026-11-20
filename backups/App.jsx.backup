import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [connected, setConnected] = useState(false)
  const [water, setWater] = useState(null)
  const [pressure, setPressure] = useState(null)
  const [air, setAir] = useState(null)
  const [temperature, setTemperature] = useState(null)
  const [humidity, setHumidity] = useState(null)

  useEffect(() => {
    let socket
    let retry
    let stopped = false

    function update(data) {
      if (!data?.sensors) return
      const s = data.sensors

      if (typeof s.water_level === 'number') setWater(s.water_level)
      if (typeof s.oxygen_pressure === 'number') setPressure(s.oxygen_pressure)
      if (typeof s.air_quality === 'number') setAir(s.air_quality)
      if (typeof s.temperature === 'number') setTemperature(s.temperature)
      if (typeof s.humidity === 'number') setHumidity(s.humidity)
    }

    function connect() {
      if (stopped) return
      socket = new WebSocket('ws://localhost:9001')

      socket.onmessage = (event) => {
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
          console.error(error)
        }
      }

      socket.onclose = () => {
        setConnected(false)
        if (!stopped) retry = setTimeout(connect, 3000)
      }

      socket.onerror = () => socket.close()
    }

    connect()

    return () => {
      stopped = true
      clearTimeout(retry)
      socket?.close()
    }
  }, [])

  function getStatus(value, type) {
    if (value === null) return 'waiting'

    if (type === 'water') {
      if (value < 20) return 'danger'
      if (value < 40) return 'warning'
      return 'good'
    }

    if (type === 'oxygen') {
      if (value < 1) return 'danger'
      if (value < 2) return 'warning'
      return 'good'
    }

    if (type === 'air') {
      if (value > 150) return 'danger'
      if (value > 100) return 'warning'
      return 'good'
    }

    if (type === 'temperature') {
      if (value > 38 || value < 10) return 'danger'
      if (value > 32 || value < 18) return 'warning'
      return 'good'
    }

    if (type === 'humidity') {
      if (value < 30 || value > 85) return 'warning'
      return 'good'
    }

    return 'good'
  }

  const statusInfo = {
    good: { color: 'green', symbol: '✓', label: 'Good' },
    warning: { color: 'yellow', symbol: '⚠', label: 'Attention' },
    danger: { color: 'red', symbol: '!', label: 'Danger' },
    waiting: { color: 'gray', symbol: '…', label: 'Waiting' }
  }

  function SensorCard({ symbol, value, unit, status, percent, color, name }) {
    const info = statusInfo[status]
    return (
      <article className={`sensor-card ${info.color}`}>
        <div className="sensor-symbol">{symbol}</div>
        <div className="sensor-value">
          {value === null ? '--' : value}
          {value !== null && unit && <small>{unit}</small>}
        </div>
        <div className="meter">
          <div
            className={`meter-fill ${color || info.color}`}
            style={{ width: `${Math.max(0, Math.min(100, percent ?? 0))}%` }}
          />
        </div>
        <div className="status-symbol">
          <span className={`status-circle ${info.color}`}>{info.symbol}</span>
        </div>
        <div className="sensor-name">{name}</div>
      </article>
    )
  }

  const waterStatus = getStatus(water, 'water')
  const oxygenStatus = getStatus(pressure, 'oxygen')
  const airStatus = getStatus(air, 'air')
  const tempStatus = getStatus(temperature, 'temperature')
  const humidityStatus = getStatus(humidity, 'humidity')

  return (
    <main className="farmer-app">
      <header className="app-header">
        <div className="logo">
          <div className="logo-symbol">S</div>
          <div className="logo-text">SeneSmart</div>
        </div>

        <div className={`connection ${connected ? 'connected' : 'disconnected'}`}>
          <span className="connection-dot" />
          <span>{connected ? '●' : '○'}</span>
        </div>
      </header>

      <section className="main-status">
        <div className={`big-status ${connected ? 'healthy' : 'disconnected'}`}>
          {connected ? '✓' : '○'}
        </div>
        <div className="main-status-text">
          <h1>{connected ? '✓' : '○'}</h1>
          <p>{connected ? ' ' : ' '}</p>
        </div>
      </section>

      <section className="sensors">
        <SensorCard
          symbol="💧"
          name=" "
          value={water === null ? null : Math.round(water)}
          unit="%"
          status={waterStatus}
          percent={water}
        />

        <SensorCard
          symbol="🫧"
          name=" "
          value={pressure === null ? null : pressure.toFixed(2)}
          unit="bar"
          status={oxygenStatus}
          percent={pressure === null ? 0 : pressure / 5 * 100}
        />

        <SensorCard
          symbol="🍃"
          name=" "
          value={air === null ? null : Math.round(air)}
          unit="AQI"
          status={airStatus}
          percent={air === null ? 0 : air / 500 * 100}
        />

        <SensorCard
          symbol="🌡️"
          name=" "
          value={temperature === null ? null : temperature.toFixed(1)}
          unit="°C"
          status={tempStatus}
          percent={temperature === null ? 0 : temperature / 50 * 100}
        />

        <SensorCard
          symbol="💦"
          name=" "
          value={humidity === null ? null : Math.round(humidity)}
          unit="%"
          status={humidityStatus}
          percent={humidity}
        />
      </section>

      <section className="legend">
        <div className="legend-item">
          <span className="legend-circle green">✓</span>
        </div>
        <div className="legend-item">
          <span className="legend-circle yellow">⚠</span>
        </div>
        <div className="legend-item">
          <span className="legend-circle red">!</span>
        </div>
      </section>

      <footer className="navigation">
        <button className="nav-button active">
          <span>⌂</span>
        </button>
        <button className="nav-button">
          <span>🌱</span>
        </button>
        <button className="nav-button">
          <span>📊</span>
        </button>
        <button className="nav-button">
          <span>⚙</span>
        </button>
      </footer>
    </main>
  )
}

export default App
