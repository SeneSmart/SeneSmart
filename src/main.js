let aiChatOpen = false;
let aiMessages = [];

function escapeChatText(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

const state = {
  tab: 'home',
  pumpOn: false,
  online: true,
  stale: false,
  scheduleEnabled: false,
  moistureEnabled: false,
  lowWaterProtection: false,
  startTime: '06:00',
  stopTime: '06:30',
  moistureStart: 35,
  moistureStop: 65,
  selectedSensor: 'S1'
}

const sensors = [
  { name: 'Soil Moisture', value: '68.5', unit: '%', icon: 'droplets', color: 'blue' },
  { name: 'Temperature', value: '27.4', unit: '°C', icon: 'thermometer', color: 'orange' },
  { name: 'Humidity', value: '72', unit: '%', icon: 'waves', color: 'purple' },
  { name: 'Water Level', value: '85', unit: '%', icon: 'droplets', color: 'cyan' },
  { name: 'Soil pH', value: '6.5', unit: 'pH', icon: 'flask', color: 'green' }
]

const icons = {
  droplets: '<path d="M12 2.5S5 10 5 14a7 7 0 0 0 14 0c0-4-7-11.5-7-11.5Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  thermometer: '<path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z"/><path d="M12 11v6"/>',
  waves: '<path d="M2 8c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 13c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 18c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M8 15h8"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/>',
  wifiOff: '<path d="M3 3l18 18"/><path d="M8.5 8.5a10 10 0 0 1 10.5 1"/><path d="M5 12.55a11 11 0 0 1 5-2.4"/><path d="M8.5 16.11a6 6 0 0 1 3.5-1.1"/><path d="M12 20h.01"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2Z"/>',
  alert: '<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v5"/><path d="M8 22h8"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>'
}

function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`
}




function getGaugePercent(sensor) {
  const value = Number(sensor.value)
  let percent = sensor.unit === '°C' ? value / 50 * 100
    : sensor.unit === 'pH' ? value / 14 * 100
    : value

  return Math.max(0, Math.min(100, percent))
}

function getFarmerCondition(sensor) {
  const value = Number(sensor.value)

  if (sensor.name === 'Soil Moisture') {
    if (value >= 60) return { label: 'SOIL IS WET', status: 'good' }
    if (value >= 35) return { label: 'SOIL IS OK', status: 'good' }
    return { label: 'SOIL IS DRY', status: 'danger' }
  }

  if (sensor.name === 'Temperature') {
    if (value >= 30) return { label: 'VERY HOT', status: 'warning' }
    if (value >= 25) return { label: 'WEATHER IS WARM', status: 'good' }
    return { label: 'WEATHER IS COOL', status: 'good' }
  }

  if (sensor.name === 'Humidity') {
    if (value >= 60) return { label: 'AIR IS HUMID', status: 'good' }
    if (value >= 40) return { label: 'AIR IS COMFORTABLE', status: 'good' }
    return { label: 'AIR IS DRY', status: 'warning' }
  }

  if (sensor.name === 'Water Level') {
    if (value >= 60) return { label: 'WATER IS PLENTY', status: 'good' }
    if (value >= 30) return { label: 'WATER IS LOW', status: 'warning' }
    return { label: 'WATER IS VERY LOW', status: 'danger' }
  }

  if (sensor.name === 'Soil pH') {
    if (value < 5.5) return { label: 'SOIL IS ACIDIC', status: 'warning' }
    if (value <= 7.5) return { label: 'SOIL IS GOOD', status: 'good' }
    return { label: 'SOIL IS ALKALINE', status: 'warning' }
  }

  return { label: 'CHECK READING', status: 'warning' }
}

function renderAutomation() {
  const active = state.scheduleEnabled || state.moistureEnabled
  const count = [
    state.scheduleEnabled,
    state.moistureEnabled,
    state.lowWaterProtection
  ].filter(Boolean).length

  return `
    <section class="automation-page">
      <section class="automation-summary card">
        <div class="automation-summary-icon">${icon('activity', 23)}</div>
        <div>
          <strong>${active ? 'Automation enabled' : 'Manual irrigation mode'}</strong>
          <p>${count} of 3 optional settings enabled</p>
        </div>
        <span class="automation-status-dot ${active ? 'active' : ''}"></span>
      </section>

      <div class="section-title">
        <div>
          <h2>Automatic controls</h2>
          <p>Enable only the rules you need</p>
        </div>
      </div>

      <section class="automation-card card">
        <div class="automation-heading">
          <div class="automation-icon schedule-icon">${icon('clock', 22)}</div>
          <div class="automation-heading-text">
            <strong>Time schedule</strong>
            <p>Set your watering hours</p>
          </div>
          <button class="switch ${state.scheduleEnabled ? 'switch-on' : ''}"
            data-action="schedule" aria-label="Toggle schedule"><span></span></button>
        </div>
        <div class="automation-fields ${state.scheduleEnabled ? '' : 'fields-disabled'}">
          <div class="automation-field">
            <label for="start-time">Start time</label>
            <input id="start-time" type="time" data-setting="startTime"
              value="${state.startTime}" ${state.scheduleEnabled ? '' : 'disabled'}>
          </div>
          <div class="automation-field">
            <label for="stop-time">Stop time</label>
            <input id="stop-time" type="time" data-setting="stopTime"
              value="${state.stopTime}" ${state.scheduleEnabled ? '' : 'disabled'}>
          </div>
        </div>
        <p class="automation-hint">Defines when automatic watering is allowed.</p>
      </section>

      <section class="automation-card card">
        <div class="automation-heading">
          <div class="automation-icon moisture-icon">${icon('droplets', 22)}</div>
          <div class="automation-heading-text">
            <strong>Soil moisture</strong>
            <p>Water according to soil condition</p>
          </div>
          <button class="switch ${state.moistureEnabled ? 'switch-on' : ''}"
            data-action="moisture" aria-label="Toggle moisture automation"><span></span></button>
        </div>
        <div class="moisture-settings ${state.moistureEnabled ? '' : 'fields-disabled'}">
          <div class="threshold-row">
            <label for="moisture-start">Start watering below</label>
            <strong><span id="start-value">${state.moistureStart}</span>%</strong>
          </div>
          <input id="moisture-start" class="moisture-slider" type="range"
            min="5" max="80" value="${state.moistureStart}"
            data-setting="moistureStart" ${state.moistureEnabled ? '' : 'disabled'}>
          <div class="threshold-row">
            <label for="moisture-stop">Stop watering above</label>
            <strong><span id="stop-value">${state.moistureStop}</span>%</strong>
          </div>
          <input id="moisture-stop" class="moisture-slider" type="range"
            min="20" max="95" value="${state.moistureStop}"
            data-setting="moistureStop" ${state.moistureEnabled ? '' : 'disabled'}>
        </div>
        <p class="automation-hint">Example: start below 35% and stop above 65%.</p>
      </section>

      <section class="automation-card card">
        <div class="automation-heading">
          <div class="automation-icon safety-icon">${icon('shield', 22)}</div>
          <div class="automation-heading-text">
            <strong>Low-water protection</strong>
            <p>Protect the pump when water is low</p>
          </div>
          <button class="switch ${state.lowWaterProtection ? 'switch-on' : ''}"
            data-action="protection" aria-label="Toggle low-water protection"><span></span></button>
        </div>
        <p class="automation-hint">Optional safety rule. The water-level threshold must be confirmed with the hardware developer.</p>
      </section>

      <section class="automation-manual card">
        <div class="automation-manual-icon">${icon('power', 20)}</div>
        <div>
          <strong>Manual control is still available</strong>
          <p>Operate the pump from the Pump tab.</p>
        </div>
      </section>

      <p class="automation-demo-note">${icon('alert', 15)} Demo settings only — no hardware commands are sent.</p>
    </section>
  `
}





function renderFarmMap() {
  const farmSensors = [
    { id: 'S1', index: 0, x: 23, y: 35, farmerName: 'Soil Wetness', label: 'SOIL IS WET', icon: 'droplets' },
    { id: 'S2', index: 1, x: 54, y: 25, farmerName: 'Weather Heat', label: 'WEATHER IS WARM', icon: 'thermometer' },
    { id: 'S3', index: 2, x: 72, y: 52, farmerName: 'Air Moisture', label: 'AIR IS HUMID', icon: 'waves' },
    { id: 'S4', index: 3, x: 39, y: 68, farmerName: 'Water Supply', label: 'WATER IS PLENTY', icon: 'droplets' },
    { id: 'S5', index: 4, x: 64, y: 79, farmerName: 'Soil Acidity', label: 'SOIL TEST', icon: 'flask' }
  ].map(item => {
    const sensor = sensors[item.index]
    const value = Number(sensor.value)
    let label = item.label

    if (item.id === 'S1') {
      label = value >= 60 ? 'SOIL IS WET' : value >= 35 ? 'SOIL IS OK' : 'SOIL IS DRY'
    }
    if (item.id === 'S2') {
      label = value >= 30 ? 'VERY HOT' : value >= 25 ? 'WEATHER IS WARM' : 'WEATHER IS COOL'
    }
    if (item.id === 'S3') {
      label = value >= 60 ? 'AIR IS HUMID' : value >= 40 ? 'AIR IS COMFORTABLE' : 'AIR IS DRY'
    }
    if (item.id === 'S4') {
      label = value >= 60 ? 'WATER IS PLENTY' : value >= 30 ? 'WATER IS LOW' : 'WATER IS VERY LOW'
    }

    return {
      ...item,
      ...sensor,
      farmerLabel: label,
      status: state.online ? 'online' : 'offline'
    }
  })

  const selected = farmSensors.find(s => s.id === state.selectedSensor) || farmSensors[0]

  return `
    <section class="simple-map-page">
      <div class="simple-map-heading">
        <div>
          <h2>Farm Map</h2>
          <p>See what is happening around your farm</p>
        </div>
        <span class="sample-label">DEMO</span>
      </div>

      <section class="simple-map-card card">
        <div class="simple-map-area">
          <svg class="farm-boundary" viewBox="0 0 360 300" role="img" aria-label="Irregular farm boundary">
            <path class="farm-boundary-fill"
              d="M53 49 L102 29 L151 39 L190 24 L244 43 L298 35 L320 78 L307 119 L326 158 L301 202 L309 246 L267 269 L218 257 L175 278 L130 260 L91 270 L58 239 L37 196 L48 154 L27 112 Z" />
            <path class="farm-boundary-line"
              d="M53 49 L102 29 L151 39 L190 24 L244 43 L298 35 L320 78 L307 119 L326 158 L301 202 L309 246 L267 269 L218 257 L175 278 L130 260 L91 270 L58 239 L37 196 L48 154 L27 112 Z" />
          </svg>

          ${farmSensors.map(sensor => `
            <button
              class="simple-sensor-marker ${state.selectedSensor === sensor.id ? 'active' : ''} ${state.online ? 'online' : 'offline'}"
              style="left:${sensor.x}%;top:${sensor.y}%"
              data-action="sensor-${sensor.id.toLowerCase()}"
              aria-label="${sensor.farmerName}: ${sensor.farmerLabel}">
              <span class="simple-marker-icon">${icon(sensor.icon, 15)}</span>
              <span class="simple-marker-label">${sensor.farmerLabel}</span>
            </button>
          `).join('')}
        </div>

        <div class="simple-map-footer">
          <span><i class="simple-status-dot online"></i> Working</span>
          <span><i class="simple-status-dot offline"></i> Not working</span>
          <span>5 locations</span>
        </div>
      </section>

      <section class="simple-selected-sensor card">
        <div class="selected-sensor-top">
          <div class="selected-sensor-icon">${icon(selected.icon, 21)}</div>
          <div class="selected-sensor-name">
            <small>SELECTED LOCATION · ${selected.id}</small>
            <strong>${selected.farmerName}</strong>
          </div>
          <span class="sensor-state ${selected.status}">
            <i></i>${selected.status === 'online' ? 'Working' : 'Not working'}
          </span>
        </div>
        <div class="selected-sensor-reading">
          <div>
            <small>What it checks</small>
            <strong>${selected.farmerName}</strong>
          </div>
          <div>
            <small>Current reading</small>
            <strong>${selected.value} ${selected.unit}</strong>
          </div>
        </div>
        <p class="farmer-reading-message">${selected.farmerLabel}</p>
      </section>

      <p class="simple-map-note">
        Sample farm shape and readings. Actual sensor positions will be adjusted to match the farm.
      </p>
    </section>
  `
}

function render() {
  const app = document.querySelector('#app')
  const online = state.online
  const pumpOn = state.pumpOn

  app.innerHTML = `
    <div class="app">
      <header class="topbar">
        <img src="/senesmart-logo.png" alt="SeneSmart">
        <div class="sene-assistant-actions">
          <button class="sene-speak-button" data-action="sene-speak" aria-label="Speak to Sene">
            <span class="sene-speak-icon">${icon("mic", 30)}</span>
          </button>

          <button class="sene-ask-button" data-action="sene-ai">
            <span class="sene-ask-icon">✦</span>
            <span>Ask Sene AI</span>
            <span class="sene-ai-tag">AI</span>
          </button>
        </div>
      </header>

      <main class="content">
        <section class="welcome">
          <div>
            <span class="eyebrow">SMART FARMING</span>
            <h1>${state.tab === 'home' ? 'Farm Overview' : state.tab === 'pump' ? 'Pump Control' : state.tab === 'automation' ? 'Automation' : 'Farm Map'}</h1>
            <p>Your farm, at a glance.</p>
          </div>
        </section>

        ${state.tab === 'home' ? `

          ${state.stale ? `
            <div class="warning">
              ${icon('alert', 17)}
              Sensor readings may be outdated.
            </div>` : ''}

          <div class="section-title">
            <div>
              <h2>Sensor Readings</h2>
              <p>Current field conditions</p>
            </div>
            <span class="sample-label">SAMPLE DATA</span>
          </div>

          <section class="sensor-grid">
            ${sensors.map(sensor => {
              const condition = getFarmerCondition(sensor)
              const gauge = getGaugePercent(sensor)

              return `
                <article class="sensor-card card">
                  <p class="sensor-card-title">${sensor.name}</p>

                  <div class="sensor-gauge ${condition.status}">
                    <svg viewBox="0 0 100 100" aria-hidden="true">
                      <circle class="gauge-track" cx="50" cy="50" r="42"
                        pathLength="100" />
                      <circle class="gauge-progress" cx="50" cy="50" r="42"
                        pathLength="100"
                        stroke-dasharray="${gauge} 100" />
                    </svg>
                    <div class="gauge-reading">
                      <strong>${sensor.value}</strong>
                      <span>${sensor.unit}</span>
                    </div>
                  </div>

                  <div class="sensor-condition ${condition.status}">
                    ${condition.label}
                  </div>
                </article>
              `
            }).join('')}
          </section>
` : state.tab === 'pump' ? `
          <section class="pump-page">
            <div class="pump-control-card card">
              <div class="big-pump-icon ${pumpOn ? 'pump-active' : ''}">${icon('power', 38)}</div>
              <span class="eyebrow">IRRIGATION SYSTEM</span>
              <h2>Water Pump</h2>
              <p class="muted">Device SEN-001</p>

              <div class="pump-status ${pumpOn ? 'status-running' : ''}">
                <span></span>${pumpOn ? 'PUMP RUNNING' : 'PUMP STOPPED'}
              </div>

              <button class="control-button ${pumpOn ? 'button-stop' : 'button-start'}" data-action="pump">
                ${icon('power', 19)}
                ${pumpOn ? 'Turn Pump OFF' : 'Turn Pump ON'}
              </button>
              <p class="demo-note">Demo control only — hardware is not connected.</p>
            </div>

            <section class="card device-settings">
              <div class="settings-icon">${icon('settings', 21)}</div>
              <div>
                <strong>Device connection</strong>
                <p>${online ? 'SEN-001 is online' : 'SEN-001 is offline'}</p>
              </div>
              <button class="icon-button" data-action="online">
                ${icon(online ? 'wifiOff' : 'wifi', 18)}
              </button>
            </section>
          </section>
        ` : state.tab === 'automation' ? renderAutomation() : renderFarmMap()}

        ${state.tab !== 'automation' && state.tab !== 'map' ? `
        <section class="developer-tools">
          <button data-action="stale">
            ${icon('alert', 15)}
            ${state.stale ? 'Clear stale warning' : 'Test stale readings'}
          </button>
        </section>
        ` : ''}
      </main>


      ${aiChatOpen ? `
        <section class="sene-chat-overlay">
          <div class="sene-chat-window">
            <header class="sene-chat-header">
              <div class="sene-chat-heading">
                <span class="sene-chat-sparkle">✦</span>
                <div>
                  <strong>Sene AI Assistant</strong>
                  <small>Your smart farming companion</small>
                </div>
              </div>
              <button class="sene-chat-close" data-action="close-ai-chat" aria-label="Close chat">×</button>
            </header>

            <div class="sene-chat-messages" id="sene-chat-messages">
              ${aiMessages.length === 0 ? `
                <div class="sene-chat-welcome">
                  <span>✦</span>
                  <strong>Hello! I'm Sene AI.</strong>
                  <p>Ask me about your soil, water levels, sensors or irrigation.</p>
                </div>
              ` : aiMessages.map(message => `
                <div class="sene-chat-message ${message.role}">
                  ${escapeChatText(message.text)}
                </div>
              `).join('')}
            </div>

            <form class="sene-chat-form" id="sene-chat-form">
              <input
                type="text"
                id="sene-chat-input"
                placeholder="Ask Sene AI a question..."
                autocomplete="off"
                required
              >
              <button type="submit" aria-label="Send message">${icon("chevron", 20)}</button>
            </form>
            <p class="sene-chat-note">AI answers will be enabled when the AI service is connected.</p>
          </div>
        </section>
      ` : ''}

      <nav class="bottom-nav">
        <button class="${state.tab === 'home' ? 'nav-active' : ''}" data-action="home">
          ${icon('dashboard', 21)}
          <span>Overview</span>
        </button>
        <button class="${state.tab === 'pump' ? 'nav-active' : ''}" data-action="pump-tab">
          ${icon('power', 21)}
          <span>Pump</span>
        </button>
        <button class="${state.tab === 'automation' ? 'nav-active' : ''}" data-action="automation">
          ${icon('settings', 21)}
          <span>Automation</span>
        </button>
        <button class="${state.tab === 'map' ? 'nav-active' : ''}" data-action="map">
          ${icon('map', 21)}
          <span>Map</span>
        </button>
      </nav>
    </div>
  `
}

document.addEventListener('change', event => {
  const setting = event.target.dataset.setting
  if (!setting) return

  state[setting] = event.target.type === 'range'
    ? Number(event.target.value)
    : event.target.value

  render()
})

document.addEventListener('input', event => {
  const setting = event.target.dataset.setting
  if (!setting || event.target.type !== 'range') return

  const outputId = setting === 'moistureStart' ? 'start-value' : 'stop-value'
  const output = document.getElementById(outputId)
  if (output) output.textContent = event.target.value
})

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]')
  if (!button) return

  switch (button.dataset.action) {
    case 'sene-ai':
      aiChatOpen = true
      break

    case 'close-ai-chat':
      aiChatOpen = false
      break;

    case 'home':
      state.tab = 'home'
      break
    case 'pump-tab':
      state.tab = 'pump'
      break
    case 'automation':
      state.tab = 'automation'
      break
    case 'map':
      state.tab = 'map'
      break
    case 'sensor-s1':
      state.selectedSensor = 'S1'
      break
    case 'sensor-s2':
      state.selectedSensor = 'S2'
      break
    case 'sensor-s3':
      state.selectedSensor = 'S3'
      break
    case 'sensor-s4':
      state.selectedSensor = 'S4'
      break
    case 'sensor-s5':
      state.selectedSensor = 'S5'
      break

    case 'schedule':
      state.scheduleEnabled = !state.scheduleEnabled
      break
    case 'moisture':
      state.moistureEnabled = !state.moistureEnabled
      break
    case 'protection':
      state.lowWaterProtection = !state.lowWaterProtection
      break
    case 'pump':
      state.pumpOn = !state.pumpOn
      break
    case 'online':
      state.online = !state.online
      break
    case 'stale':
      state.stale = !state.stale
      break
  }

  render()
})


document.addEventListener('submit', event => {
  if (event.target.id !== 'sene-chat-form') return

  event.preventDefault()
  const input = document.getElementById('sene-chat-input')
  const question = input?.value.trim()
  if (!question) return

  aiMessages.push({ role: 'user', text: question })
  render()

  const messages = document.getElementById('sene-chat-messages')
  if (messages) messages.scrollTop = messages.scrollHeight
})

render()
