import { VoskClient } from '@lichess-org/vosk-browser';

let aiChatOpen = false;
let aiMessages = [];
let drawingPointerId = null;
let activeMapDrawing = null;

let voskClient = null;
let voskLoadPromise = null;
let voskRecognizer = null;
let voskRecognizerSampleRate = null;
let voiceStream = null;
let voiceAudioContext = null;
let voiceSource = null;
let voiceProcessor = null;
let voiceMuteGain = null;
let voiceListening = false;
let voiceStatus = '';
let voicePartial = '';
let lastVoiceRender = 0;


const savedFarmBoundary = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('senesmart-farm-boundary') || 'null');
    return Array.isArray(saved) ? saved : null;
  } catch {
    return null;
  }
})();

const savedMapDrawings = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('senesmart-map-drawings') || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
})();

const savedSensorPositions = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('senesmart-sensor-positions') || '[]');

    if (Array.isArray(saved)) {
      return saved.filter(item =>
        item && typeof item.id === 'string' &&
        /^S[1-7]$/.test(item.type) &&
        Number.isFinite(item.x) && Number.isFinite(item.y)
      );
    }

    if (saved && typeof saved === 'object') {
      return Object.entries(saved)
        .filter(([type, position]) =>
          /^S[1-7]$/.test(type) &&
          position &&
          Number.isFinite(position.x) &&
          Number.isFinite(position.y)
        )
        .map(([type, position], index) => ({
          id: `legacy-${type}-${index}`,
          type,
          x: position.x,
          y: position.y
        }));
    }

    return [];
  } catch {
    return [];
  }
})();

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
  selectedSensor: null,
  mapSettingsOpen: false,
  drawMode: false,
  mapDrawings: savedMapDrawings,
  drawingTool: 'pen',
  drawingColor: '#176b3b',
  drawingZoneName: 'Farm boundary',
  mapBoundary: savedFarmBoundary,
  previousMapBoundary: null,
  sensorPositions: savedSensorPositions,
  placingSensor: null,
  sensorPositionsOriginal: null,
  pendingSensorPositions: null
}

const sensors = [
  { name: 'Soil Moisture', value: '68.5', unit: '%', icon: 'droplets', color: 'blue' },
  { name: 'Temperature', value: '27.4', unit: '°C', icon: 'thermometer', color: 'orange' },
  { name: 'Humidity', value: '72', unit: '%', icon: 'waves', color: 'purple' },
  { name: 'Soil pH', value: '6.5', unit: 'pH', icon: 'flask', color: 'green' },
  { name: 'Water Tank Level', value: '85', unit: '%', icon: 'tank', color: 'cyan' },
  { name: 'Air Quality', value: '186', unit: '%', icon: 'wind', color: 'teal' },
  { name: 'Soil Quality', value: '—', unit: '', icon: 'soil-quality', color: 'brown', configured: false }
]

const icons = {
  droplets: '<path d="M12 2.5S5 10 5 14a7 7 0 0 0 14 0c0-4-7-11.5-7-11.5Z"/><path d="M8.5 14.5a3.5 3.5 0 0 0 3.5 3.5"/>',
  thermometer: '<path d="M14 14.2V5a2 2 0 0 0-4 0v9.2a4.5 4.5 0 1 0 4 0Z"/><path d="M12 11v6"/><path d="M16.5 7h2"/><path d="M16.5 10h1.5"/>',
  waves: '<path d="M2.5 8.5c2.4 0 2.4-2.5 4.8-2.5s2.4 2.5 4.7 2.5 2.4-2.5 4.8-2.5 2.4 2.5 4.7 2.5"/><path d="M2.5 14c2.4 0 2.4-2.5 4.8-2.5S9.7 14 12 14s2.4-2.5 4.8-2.5 2.4 2.5 4.7 2.5"/><path d="M5 19c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2"/>',
  'soil-quality': '<path d="M3 20h18"/><path d="M5 20c0-5 3-8 7-8s7 3 7 8"/><path d="M12 12V4"/><path d="m8.5 7.5 3.5-3.5 3.5 3.5"/><path d="M8 16h8"/>',
  wind: '<path d="M3 8h12a3 3 0 1 0-3-3"/><path d="M2 12h16a3 3 0 1 1-3 3"/><path d="M4 16h6a2 2 0 1 1-2 2"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6.2l-5.4 8.7A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-3.1L14 9.2V3"/><path d="M7.5 15h9"/><path d="m10 12 1 1 1-1"/>',
  tank: '<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5Z"/><path d="M8 5.5V3h8v2.5"/><path d="M4 13h16"/><path d="M8 16.5h.01M12 16.5h.01M16 16.5h.01"/>',
  wifi: '<path d="M2.5 9a15 15 0 0 1 19 0"/><path d="M5.5 12.5a10.5 10.5 0 0 1 13 0"/><path d="M8.8 16a5.3 5.3 0 0 1 6.4 0"/><circle cx="12" cy="19.5" r=".8" fill="currentColor" stroke="none"/>',
  wifiOff: '<path d="m3 3 18 18"/><path d="M8.5 8.5A15 15 0 0 1 21.5 9"/><path d="M5.5 12.5a10.5 10.5 0 0 1 4-2"/><path d="M8.8 16a5.3 5.3 0 0 1 3.2-1"/><path d="M12 19.5h.01"/>',
  activity: '<path d="M2.5 12h4l3-7.5 5 15 3-7.5h4"/><path d="M2.5 12h1"/>',
  power: '<path d="M12 2.5v9"/><path d="M7.1 5.8a9 9 0 1 0 9.8 0"/><path d="M9.5 17.5h5"/>',
  dashboard: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><path d="M6 6h2M16 6h2M16 13h2M6 16h2"/>',
  settings: '<rect x="2.5" y="4" width="19" height="3.5" rx="1.75" fill="currentColor" stroke="none"/><rect x="2.5" y="10.25" width="19" height="3.5" rx="1.75" fill="currentColor" stroke="none"/><rect x="2.5" y="16.5" width="19" height="3.5" rx="1.75" fill="currentColor" stroke="none"/><circle cx="8" cy="5.75" r="3" fill="white" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="12" r="3" fill="white" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="18.25" r="3" fill="white" stroke="currentColor" stroke-width="2"/>',
  alert: '<path d="M10.3 3.8 2.4 17.5A2.3 2.3 0 0 0 4.4 21h15.2a2.3 2.3 0 0 0 2-3.5L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4.5"/><circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/><path d="M8 2.8 6.5 4M16 2.8 17.5 4"/>',
  shield: '<path d="M12 22s8-3.8 8-10.5V5l-8-3-8 3v6.5C4 18.2 12 22 12 22Z"/><path d="m8.5 12 2.3 2.3 4.8-5"/><path d="M9 5.5h6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  'arrow-left': '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  'edit-3': '<path d="m14 6 4 4"/><path d="M4 20l4.2-.9L19 8.3a2.8 2.8 0 0 0-4-4L4.9 15.8 4 20Z"/><path d="M13 20h8"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/><path d="M12 8.5a2.5 2.5 0 0 1 2.5 2.5c0 2-2.5 4.5-2.5 4.5S9.5 13 9.5 11A2.5 2.5 0 0 1 12 8.5Z"/><circle cx="12" cy="11" r=".7"/>',
  'map-pin': '<path d="M20 10c0 5.2-8 12-8 12S4 15.2 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.8"/>',
  pin: '<path d="M20 10c0 5.2-8 12-8 12S4 15.2 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.8"/>',
  'radio-tower': '<path d="M12 17v5"/><path d="m8 22 4-5 4 5"/><path d="M8.5 13.5a5 5 0 0 1 0-7"/><path d="M15.5 6.5a5 5 0 0 1 0 7"/><path d="M5.5 16.5a9 9 0 0 1 0-13"/><path d="M18.5 3.5a9 9 0 0 1 0 13"/><circle cx="12" cy="4" r="1"/>',
  mic: '<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4.5"/><path d="M8 21.5h8"/>'
}

function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`
}




function getGaugePercent(sensor) {
  if (sensor.configured === false) return 0
  const value = Number(sensor.value)
  if (!Number.isFinite(value)) return 0
  if (sensor.name === 'Air Quality') return Math.max(0, Math.min(100, value / 4095 * 100))
  let percent = sensor.unit === '°C' ? value / 50 * 100
    : sensor.unit === 'pH' ? value / 14 * 100
    : value

  return Math.max(0, Math.min(100, percent))
}

function soilRangeScore(value, idealMin, idealMax, lowerLimit, upperLimit) {
  if (value < lowerLimit || value > upperLimit) return 0
  if (value >= idealMin && value <= idealMax) return 100
  if (value < idealMin) {
    return (value - lowerLimit) / (idealMin - lowerLimit) * 100
  }
  return (upperLimit - value) / (upperLimit - idealMax) * 100
}

function updateSoilQuality() {
  const moisture = sensors.find(sensor => sensor.name === 'Soil Moisture')
  const temperature = sensors.find(sensor => sensor.name === 'Temperature')
  const ph = sensors.find(sensor => sensor.name === 'Soil pH')
  const quality = sensors.find(sensor => sensor.name === 'Soil Quality')

  if (!moisture || !temperature || !ph || !quality) return

  const moistureValue = Number(moisture.value)
  const temperatureValue = Number(temperature.value)
  const phValue = Number(ph.value)

  if (![moistureValue, temperatureValue, phValue].every(Number.isFinite)) {
    quality.value = '—'
    quality.configured = false
    return
  }

  const moistureScore = soilRangeScore(moistureValue, 45, 65, 15, 95)
  const temperatureScore = soilRangeScore(temperatureValue, 18, 30, 5, 40)
  const phScore = soilRangeScore(phValue, 6, 7, 4.5, 8.5)

  const score = Math.round(
    moistureScore * 0.35 +
    phScore * 0.40 +
    temperatureScore * 0.25
  )

  quality.value = String(score)
  quality.unit = '%'
  quality.configured = true
  quality.calculated = true
}

function getFarmerCondition(sensor) {
  if (sensor.configured === false) {
    return { label: 'NOT CONFIGURED', status: 'warning' }
  }

  const value = Number(sensor.value)

  if (sensor.name === 'Air Quality') {
    const airQualityPercent = getGaugePercent(sensor)
    if (airQualityPercent < 40) return { label: 'BAD', status: 'danger' }
    if (airQualityPercent < 60) return { label: 'FAIR', status: 'warning' }
    if (airQualityPercent < 80) return { label: 'GOOD', status: 'good' }
    return { label: 'EXCELLENT', status: 'good' }
  }

  if (sensor.name === 'Soil Quality') {
    if (value < 40) return { label: 'POOR', status: 'danger' }
    if (value < 60) return { label: 'FAIR', status: 'warning' }
    if (value < 80) return { label: 'GOOD', status: 'good' }
    return { label: 'EXCELLENT', status: 'good' }
  }

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

  if (sensor.name === 'Water Tank Level') {
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





function renderMapSettings() {
  const boundarySaved = Array.isArray(state.mapBoundary) && state.mapBoundary.length >= 3

  const sensorNames = [
    ['S1', 'Soil Wetness', 'Soil moisture'],
    ['S2', 'Weather Heat', 'Temperature'],
    ['S3', 'Air Moisture', 'Humidity'],
    ['S4', 'Water Supply', 'Water tank level'],
    ['S5', 'Soil Acidity', 'Soil pH'],
    ['S6', 'Air Quality', 'Air quality'],
    ['S7', 'Soil Quality', 'Soil nutrients and condition']
  ]

  return `
    <section class="farm-settings-page">
      <button class="farm-settings-back" data-action="map">
        ${icon('arrow-left', 18)}
        Back to Map
      </button>

      <section class="farm-settings-card card">
        <div class="farm-settings-heading">
          <div class="farm-settings-icon">${icon('map', 23)}</div>
          <div>
            <h2>Farm Boundary</h2>
            <p>Define the shape and size of your farm</p>
          </div>
        </div>

        <div class="farm-boundary-status">
          <span class="farm-settings-status-dot ${boundarySaved ? 'saved' : ''}"></span>
          <span>${boundarySaved ? 'Farm boundary saved' : 'Farm boundary not set'}</span>
        </div>

        <button class="farm-settings-primary" data-action="start-map-drawing">
          ${icon('edit-3', 18)}
          ${boundarySaved ? 'Update Farm Boundary' : 'Draw Farm Boundary'}
        </button>
      </section>

      <section class="farm-settings-card card">
        <div class="farm-settings-heading">
          <div class="farm-settings-icon">${icon('map-pin', 23)}</div>
          <div>
            <h2>Sensor Locations</h2>
            <p>Manage the sensors installed on your farm</p>
          </div>
        </div>

        <div class="farm-settings-sensor-list">
          ${sensorNames.map(sensor => `
            <div class="farm-settings-sensor">
              <div class="farm-settings-sensor-icon">${icon(sensors[Number(sensor[0].slice(1)) - 1].icon, 19)}</div>
              <div>
                <strong>${sensor[1]}</strong>
                <small>${sensor[0]} · ${sensor[2]}</small>
                <span class="farm-settings-location">${
                  state.sensorPositions.filter(position => position.type === sensor[0]).length
                    ? `${state.sensorPositions.filter(position => position.type === sensor[0]).length} location(s) placed`
                    : 'Not placed'
                }</span>
              </div>
              <button class="farm-settings-place-button"
                data-action="place-sensor-${sensor[0].toLowerCase()}"
                ${boundarySaved ? '' : 'disabled'}>
                ${state.sensorPositions.some(position => position.type === sensor[0]) ? 'Add another' : 'Place'}
              </button>
            </div>
          `).join('')}
        </div>

        <p class="farm-settings-hint">
          ${boundarySaved ? 'Choose Place or Move, then tap the sensor location inside your farm boundary.' : 'Draw and save your farm boundary before placing sensors.'}
        </p>
      </section>
    </section>
  `
}

function renderFarmMap() {
  const sensorTypes = [
    { id: 'S1', index: 0, farmerName: 'Soil Wetness', icon: 'droplets' },
    { id: 'S2', index: 1, farmerName: 'Weather Heat', icon: 'thermometer' },
    { id: 'S3', index: 2, farmerName: 'Air Moisture', icon: 'waves' },
    { id: 'S4', index: 4, farmerName: 'Water Supply', icon: 'tank' },
    { id: 'S5', index: 3, farmerName: 'Soil Acidity', icon: 'flask' },
    { id: 'S6', index: 5, farmerName: 'Air Quality', icon: 'wind' },
    { id: 'S7', index: 6, farmerName: 'Soil Quality', icon: 'soil-quality' }
  ];

  const farmSensors = state.sensorPositions.map(placement => {
    const type = sensorTypes.find(sensor => sensor.id === placement.type);
    if (!type) return null;

    const sensor = sensors[type.index];
    const value = Number(sensor.value);
    let label = 'SENSOR ACTIVE';

    if (placement.type === 'S1') {
      label = value >= 60 ? 'SOIL IS WET' : value >= 35 ? 'SOIL IS OK' : 'SOIL IS DRY';
    } else if (placement.type === 'S2') {
      label = value >= 30 ? 'VERY HOT' : value >= 25 ? 'WEATHER IS WARM' : 'WEATHER IS COOL';
    } else if (placement.type === 'S3') {
      label = value >= 60 ? 'AIR IS HUMID' : value >= 40 ? 'AIR IS COMFORTABLE' : 'AIR IS DRY';
    } else if (placement.type === 'S4') {
      label = value >= 60 ? 'WATER IS PLENTY' : value >= 30 ? 'WATER IS LOW' : 'WATER IS VERY LOW';
    } else if (placement.type === 'S7') {
      label = getFarmerCondition(sensor).label;
    }

    return {
      ...placement,
      ...type,
      ...sensor,
      farmerLabel: label,
      status: sensor.configured === false ? 'offline' : state.online ? 'online' : 'offline'
    };
  }).filter(Boolean);

  const selected = farmSensors.find(sensor => sensor.id === state.selectedSensor) || null

  return `
    <section class="simple-map-page">
      <div class="simple-map-heading">
        <div>
          <h2>Farm Map</h2>
          <p>See what is happening around your farm</p>
        </div>
        <button class="map-settings-button" data-action="map-settings"
          aria-label="Open farm map settings" aria-expanded="${state.mapSettingsOpen}">
          ${icon('settings', 21)}
        </button>
      </div>

      ${state.mapSettingsOpen ? `
        <section class="map-settings-panel card">
          <div class="map-settings-panel-heading">
            <div class="map-settings-icon">${icon('settings', 19)}</div>
            <div>
              <strong>Farm Setup</strong>
              <p>Configure your farm map</p>
            </div>
          </div>
          <button class="map-settings-option map-settings-action"
            data-action="start-map-drawing">
            ${icon('map', 18)}
            <span>Draw Farm Boundary</span>
            ${icon('chevron', 17)}
          </button>
          <div class="map-settings-option">
            ${icon('map-pin', 18)}
            <span>Sensor placement</span>
          </div>
          <p class="map-settings-note">Farm drawing and sensor placement tools will be added here.</p>
        </section>
      ` : ''}

      ${state.placingSensor || (state.pendingSensorPositions && state.pendingSensorPositions.length) ? `
        <section class="sensor-placement-banner">
          <div>
            <strong>${state.placingSensor ? `Place sensor ${state.placingSensor}` : 'Sensor locations ready to save'}</strong>
            <p>${state.placingSensor
              ? 'Tap the exact location on your farm map.'
              : `${state.pendingSensorPositions.length} sensor location(s) staged. You can add more or save them.`}</p>
          </div>
          <div class="sensor-placement-actions">
            ${!state.placingSensor ? '<button data-action="add-another-sensor">Add another</button><button data-action="save-sensor-locations">Save Sensor Locations</button>' : ''}
            <button data-action="cancel-sensor-locations">Cancel</button>
          </div>
        </section>
      ` : ''}

      ${state.drawMode ? `
        <section class="map-draw-toolbar card">
          <strong>Draw your farm boundary</strong>
          <p>Tap around the edges of your farm to mark its corners.</p>
          <span class="map-point-count">${state.mapBoundary.length} points marked</span>
          <div class="map-draw-actions">
            <button data-action="undo-map-point" ${state.mapBoundary.length ? '' : 'disabled'}>
              Undo
            </button>
            <button class="map-finish-button" data-action="finish-map-drawing"
              ${state.mapBoundary.length < 3 ? 'disabled' : ''}>
              Finish & Save
            </button>
            <button data-action="cancel-map-drawing">Cancel</button>
          </div>
        </section>
      ` : ''}

      <section class="simple-map-card card">
        <div class="simple-map-area map-drawing-area farm-map-canvas">
          <svg class="farm-boundary paint-canvas" viewBox="0 0 1000 700"
            preserveAspectRatio="none" role="img" aria-label="Farm boundary">
            ${state.mapBoundary === null ? `
              <g transform="scale(2.7777778 2.3333333)">
                <path class="farm-boundary-fill"
                  d="M53 49 L102 29 L151 39 L190 24 L244 43 L298 35 L320 78 L307 119 L326 158 L301 202 L309 246 L267 269 L218 257 L175 278 L130 260 L91 270 L58 239 L37 196 L48 154 L27 112 Z" />
                <path class="farm-boundary-line"
                  d="M53 49 L102 29 L151 39 L190 24 L244 43 L298 35 L320 78 L307 119 L326 158 L301 202 L309 246 L267 269 L218 257 L175 278 L130 260 L91 270 L58 239 L37 196 L48 154 L27 112 Z" />
              </g>
            ` : `
              ${state.mapBoundary.length >= 3 ? `
                <polygon class="farm-boundary-fill"
                  points="${state.mapBoundary.map(p => `${p.x * 10},${p.y * 7}`).join(' ')}" />
              ` : ''}
              ${state.mapBoundary.length >= 2 ? `
                <polyline class="farm-boundary-line"
                  points="${state.mapBoundary.map(p => `${p.x * 10},${p.y * 7}`).join(' ')}" />
              ` : ''}
            `}
            <g id="saved-drawings-layer">
              ${state.mapDrawings.map((drawing, index) => {
                const color = drawing.color || '#176b3b'
                const name = escapeChatText(drawing.zoneName || `Drawing ${index + 1}`)

                if (drawing.type === 'pen') {
                  const points = (drawing.points || [])
                    .map(point => `${point.x * 10},${point.y * 7}`)
                    .join(' ')
                  return `<polyline points="${points}" fill="none" stroke="${color}"
                    stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
                    vector-effect="non-scaling-stroke"><title>${name}</title></polyline>`
                }

                if (drawing.type === 'rect') {
                  return `<rect x="${drawing.x * 10}" y="${drawing.y * 7}"
                    width="${drawing.w * 10}" height="${drawing.h * 7}"
                    fill="${color}" fill-opacity=".16" stroke="${color}"
                    stroke-width="3" vector-effect="non-scaling-stroke">
                    <title>${name}</title></rect>`
                }

                if (drawing.type === 'circle') {
                  return `<ellipse cx="${(drawing.x + drawing.w / 2) * 10}"
                    cy="${(drawing.y + drawing.h / 2) * 7}"
                    rx="${Math.abs(drawing.w) * 5}" ry="${Math.abs(drawing.h) * 3.5}"
                    fill="${color}" fill-opacity=".16" stroke="${color}"
                    stroke-width="3" vector-effect="non-scaling-stroke">
                    <title>${name}</title></ellipse>`
                }

                return ''
              }).join('')}
            </g>
          </svg>

          ${farmSensors.map(sensor => `
            <button
              class="simple-sensor-marker ${state.selectedSensor === sensor.id ? 'active' : ''} ${sensor.status}"
              style="left:${sensor.x}%;top:${sensor.y}%"
              data-action="select-placement"
              data-placement-id="${sensor.id}"
              aria-label="${sensor.farmerName}: ${sensor.farmerLabel}">
              <span class="simple-marker-icon">${icon(sensor.icon, 15)}</span>
              <span class="simple-marker-label">${sensor.farmerName}</span>
            </button>
          `).join('')}
        </div>

        <div class="simple-map-footer">
          <span><i class="simple-status-dot online"></i> Working</span>
          <span><i class="simple-status-dot offline"></i> Not working</span>
          <span>${farmSensors.length} placed location(s)</span>
        </div>
      </section>

      ${selected ? `
      <section class="simple-selected-sensor card">
        <div class="selected-sensor-top">
          <div class="selected-sensor-icon">${icon(selected.icon, 21)}</div>
          <div class="selected-sensor-name">
            <small>SELECTED LOCATION · ${selected.type}</small>
            <strong>${selected.farmerName}</strong>
          </div>
          <span class="sensor-state ${selected.status}">
            <i></i>${selected.calculated ? 'Calculated' : selected.configured === false ? 'Not configured' : selected.status === 'online' ? 'Working' : 'Not working'}
          </span>
        </div>
        <div class="selected-sensor-reading">
          <div>
            <small>What it checks</small>
            <strong>${selected.calculated ? 'Moisture + pH + temperature' : selected.farmerName}</strong>
          </div>
          <div>
            <small>Current reading</small>
            <strong>${selected.configured === false ? 'Not configured' : `${selected.value} ${selected.unit}${selected.calculated ? ' · Calculated' : ''}`}</strong>
          </div>
        </div>
        <p class="farmer-reading-message">${selected.farmerLabel}</p>
      </section>
      ` : `
      <section class="simple-selected-sensor card">
        <strong>No sensors placed yet</strong>
        <p>Open Farm Setup to add your first sensor location.</p>
      </section>
      `}

      <p class="simple-map-note">
        Sample farm shape and readings. Actual sensor positions will be adjusted to match the farm.
      </p>
    </section>
  `
}


function renderSensorPlacement() {
  const placementSensors = [
    { id: 'S1', name: 'Soil Wetness', detail: 'Soil moisture', icon: sensors[0].icon },
    { id: 'S2', name: 'Weather Heat', detail: 'Temperature', icon: sensors[1].icon },
    { id: 'S3', name: 'Air Moisture', detail: 'Humidity', icon: sensors[2].icon },
    { id: 'S4', name: 'Water Supply', detail: 'Water tank level', icon: sensors[4].icon },
    { id: 'S5', name: 'Soil Acidity', detail: 'Soil pH', icon: sensors[3].icon },
    { id: 'S6', name: 'Air Quality', detail: 'Air quality', icon: sensors[5].icon },
    { id: 'S7', name: 'Soil Quality', detail: 'Calculated soil condition', icon: sensors[6].icon }
  ];

  const placements = state.pendingSensorPositions || [];
  const placedCount = placements.length;

  return `
    <section class="simple-map-page sensor-placement-screen">
      <div class="simple-map-heading">
        <div>
          <h2>Place Your Sensors</h2>
          <p>Select a sensor, then tap its position on your farm map. You can place the same sensor type more than once.</p>
        </div>
      </div>

      <section class="farm-settings-card card">
        <div class="farm-settings-heading">
          <div class="farm-settings-icon">${icon('map-pin', 23)}</div>
          <div>
            <h2>Choose a Sensor</h2>
            <p>Choose a type and tap the map to add a location</p>
          </div>
        </div>

        <div class="farm-settings-sensor-list">
          ${placementSensors.map(sensor => {
            const count = placements.filter(item => item.type === sensor.id).length;
            return `
              <div class="farm-settings-sensor">
                <div class="farm-settings-sensor-icon">${icon(sensor.icon, 19)}</div>
                <div>
                  <strong>${sensor.name}</strong>
                  <small>${sensor.id} · ${sensor.detail}</small>
                  <span class="farm-settings-location">
                    ${count ? `${count} location(s) in this session` : 'No new locations'}
                  </span>
                </div>
                <button class="farm-settings-place-button"
                  data-action="place-sensor-${sensor.id.toLowerCase()}">
                  ${state.placingSensor === sensor.id ? 'Selected' : 'Select'}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <section class="sensor-placement-banner">
        <div>
          <strong>${state.placingSensor
            ? `Now placing ${placementSensors.find(sensor => sensor.id === state.placingSensor)?.name || state.placingSensor}`
            : 'Select a sensor above'}</strong>
          <p>${state.placingSensor
            ? 'Tap the exact position inside your farm map. The sensor stays selected so you can add it again.'
            : `${placedCount} new location(s) ready to save.`}</p>
        </div>
      </section>

      <section class="simple-map-card card">
        <div class="simple-map-area map-drawing-area farm-map-canvas sensor-placement-canvas">
          <svg class="farm-boundary paint-canvas" viewBox="0 0 1000 700"
            preserveAspectRatio="none" role="img" aria-label="Farm sensor placement map">
            ${state.mapBoundary && state.mapBoundary.length >= 3 ? `
              <polygon class="farm-boundary-fill"
                points="${state.mapBoundary.map(point => `${point.x * 10},${point.y * 7}`).join(' ')}" />
              <polygon class="farm-boundary-line"
                points="${state.mapBoundary.map(point => `${point.x * 10},${point.y * 7}`).join(' ')}" />
            ` : ''}
          </svg>

          ${placements.map(placement => {
            const sensor = placementSensors.find(item => item.id === placement.type);
            if (!sensor) return '';
            return `
              <div
                class="simple-sensor-marker ${state.placingSensor === placement.type ? 'active' : ''}"
                data-placement-marker
                style="left:${placement.x}%;top:${placement.y}%"
                aria-label="${sensor.name}">
                <span class="simple-marker-icon">${icon(sensor.icon, 15)}</span>
                <span class="simple-marker-label">${sensor.id}</span>
              </div>
            `;
          }).join('')}
        </div>
        <div class="simple-map-footer">
          <span>${placedCount} new location(s)</span>
          <span>${placementSensors.length} sensor types available</span>
        </div>
      </section>

      <div class="map-drawing-actions sensor-placement-actions">
        <button data-action="cancel-sensor-locations">Cancel</button>
        <button class="map-finish-button" data-action="save-sensor-locations"
          ${placedCount === 0 ? 'disabled' : ''}>
          Save Sensor Locations
        </button>
      </div>
    </section>
  `;
}

function renderMapDrawing() {
  const drawings = state.mapDrawings.map((drawing, index) => {
    const color = drawing.color || '#176b3b';
    const name = escapeChatText(drawing.zoneName || `Drawing ${index + 1}`);

    if (drawing.type === 'pen') {
      const points = (drawing.points || [])
        .map(point => `${point.x * 10},${point.y * 7}`)
        .join(' ');
      return `<polyline points="${points}" fill="none" stroke="${color}"
        stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
        vector-effect="non-scaling-stroke"><title>${name}</title></polyline>`;
    }

    if (drawing.type === 'rect') {
      return `<rect x="${drawing.x * 10}" y="${drawing.y * 7}"
        width="${drawing.w * 10}" height="${drawing.h * 7}"
        fill="${color}" fill-opacity=".16" stroke="${color}"
        stroke-width="3" vector-effect="non-scaling-stroke">
        <title>${name}</title></rect>`;
    }

    if (drawing.type === 'circle') {
      return `<ellipse cx="${(drawing.x + drawing.w / 2) * 10}"
        cy="${(drawing.y + drawing.h / 2) * 7}"
        rx="${Math.abs(drawing.w) * 5}" ry="${Math.abs(drawing.h) * 3.5}"
        fill="${color}" fill-opacity=".16" stroke="${color}"
        stroke-width="3" vector-effect="non-scaling-stroke">
        <title>${name}</title></ellipse>`;
    }

    return '';
  }).join('');

  return `
    <section class="map-drawing-workspace">
      <header class="map-drawing-header">
        <h2>Farm Map Editor</h2>
        <p>Draw your farm boundary and create separate farming zones. Your drawings stay on the canvas.</p>
        <strong>${state.mapDrawings.length} drawing objects</strong>
      </header>

      <div class="paint-toolbar">
        <button data-action="tool-pen" class="${state.drawingTool === 'pen' ? 'active' : ''}">✎ Pen</button>
        <button data-action="tool-rect" class="${state.drawingTool === 'rect' ? 'active' : ''}">▭ Rectangle</button>
        <button data-action="tool-circle" class="${state.drawingTool === 'circle' ? 'active' : ''}">◯ Circle</button>
        <button data-action="tool-eraser" class="${state.drawingTool === 'eraser' ? 'active' : ''}">⌫ Eraser</button>
        <button data-action="undo-map-point">↶ Undo</button>
      </div>

      <div class="paint-options">
        <label>Zone name
          <input id="drawing-zone-name" type="text"
            value="${escapeChatText(state.drawingZoneName)}" maxlength="40">
        </label>
        <label>Color
          <select id="drawing-color">
            <option value="#176b3b" ${state.drawingColor === '#176b3b' ? 'selected' : ''}>Green</option>
            <option value="#2474d2" ${state.drawingColor === '#2474d2' ? 'selected' : ''}>Blue</option>
            <option value="#e69a22" ${state.drawingColor === '#e69a22' ? 'selected' : ''}>Orange</option>
            <option value="#9b59b6" ${state.drawingColor === '#9b59b6' ? 'selected' : ''}>Purple</option>
            <option value="#d94b4b" ${state.drawingColor === '#d94b4b' ? 'selected' : ''}>Red</option>
          </select>
        </label>
      </div>

      <div class="simple-map-area map-drawing-area">
        <svg class="farm-boundary paint-canvas" viewBox="0 0 1000 700"
          preserveAspectRatio="none" aria-label="Farm drawing canvas">
          ${state.mapBoundary && state.mapBoundary.length >= 3 ? `
            <polygon points="${state.mapBoundary.map(point => `${point.x * 10},${point.y * 7}`).join(' ')}"
              fill="#176b3b" fill-opacity=".08" stroke="#176b3b"
              stroke-width="3" vector-effect="non-scaling-stroke"/>
          ` : ''}
          <g id="saved-drawings-layer">${drawings}</g>
          <g id="active-drawing-layer"></g>
        </svg>
      </div>

      <div class="map-drawing-actions">
        <button data-action="cancel-map-drawing">Cancel</button>
        <button data-action="clear-map-drawings">Clear All</button>
        <button data-action="finish-map-drawing">Save Farm Map</button>
      </div>
    </section>
  `;
}

function getOverallFarmHealth() {
  // Each physical sensor contributes according to its importance.
  // Soil Quality is calculated from other sensors, so it is not counted twice.
  const sensorWeights = {
    'Soil Moisture': 0.28,
    'Temperature': 0.18,
    'Soil pH': 0.18,
    'Water Tank Level': 0.16,
    'Humidity': 0.10,
    'Air Quality': 0.10
  }

  const clamp = (value, min = 0, max = 100) =>
    Math.max(min, Math.min(max, value))

  const rangeScore = (value, idealMin, idealMax, lowerLimit, upperLimit) =>
    clamp(soilRangeScore(value, idealMin, idealMax, lowerLimit, upperLimit))

  const readings = {}

  for (const sensor of sensors) {
    const weight = sensorWeights[sensor.name]
    if (!weight || sensor.configured === false) continue

    const value = Number(sensor.value)
    if (!Number.isFinite(value)) continue

    // Reject impossible readings instead of allowing them to distort the score.
    const limits = {
      'Soil Moisture': [0, 100],
      'Temperature': [-10, 60],
      'Soil pH': [0, 14],
      'Water Tank Level': [0, 100],
      'Humidity': [0, 100],
      'Air Quality': [0, 4095]
    }[sensor.name]

    if (!limits || value < limits[0] || value > limits[1]) continue

    readings[sensor.name] = { value, weight }
  }

  const names = Object.keys(readings)

  if (!names.length) {
    return {
      label: 'FARM STATUS UNAVAILABLE',
      status: 'warning',
      score: null
    }
  }

  const scores = {
    'Soil Moisture': value =>
      rangeScore(value, 45, 65, 15, 95),

    'Temperature': value =>
      rangeScore(value, 18, 30, 5, 40),

    'Soil pH': value =>
      rangeScore(value, 6, 7, 4.5, 8.5),

    'Water Tank Level': value =>
      rangeScore(value, 60, 100, 0, 100),

    'Humidity': value =>
      rangeScore(value, 45, 70, 20, 95),

    'Air Quality': value => {
      const percent = clamp(value / 4095 * 100)

      if (percent < 40) return percent / 40 * 45
      if (percent < 60) return 45 + (percent - 40) / 20 * 25
      if (percent < 80) return 70 + (percent - 60) / 20 * 20
      return 90 + (percent - 80) / 20 * 10
    }
  }

  let weightedTotal = 0
  let availableWeight = 0

  for (const name of names) {
    const reading = readings[name]
    weightedTotal += scores[name](reading.value) * reading.weight
    availableWeight += reading.weight
  }

  let score = weightedTotal / availableWeight

  const moisture = readings['Soil Moisture']?.value
  const temperature = readings['Temperature']?.value
  const humidity = readings['Humidity']?.value
  const water = readings['Water Tank Level']?.value
  const ph = readings['Soil pH']?.value

  // Context: dry soil is more serious when there is not enough water available.
  if (moisture !== undefined && moisture < 35) {
    if (water !== undefined && water < 30) {
      score -= 10
    } else if (water !== undefined && water >= 60) {
      // Water is available, so the problem may be corrected through irrigation.
      score += 3
    } else {
      score -= 5
    }
  }

  // Context: heat, dry air and dry soil together create greater crop stress.
  if (
    moisture !== undefined && moisture < 35 &&
    temperature !== undefined && temperature >= 30 &&
    humidity !== undefined && humidity < 40
  ) {
    score -= 8
  }

  // Very low water is less urgent when the soil still has enough moisture.
  if (
    water !== undefined && water < 30 &&
    moisture !== undefined && moisture >= 45
  ) {
    score += 2
  }

  // Serious individual conditions still matter, even when other readings look good.
  if (moisture !== undefined && moisture < 15) score -= 12
  if (water !== undefined && water < 10) score -= 8
  if (ph !== undefined && (ph < 4.5 || ph > 8.5)) score -= 8

  score = Math.round(clamp(score))

  // Critical conditions can make the farm BAD even if the average is higher.
  const criticalCondition =
    (moisture !== undefined && moisture < 10) ||
    (moisture !== undefined && moisture < 15 &&
      water !== undefined && water < 30) ||
    (temperature !== undefined && (temperature >= 40 || temperature <= 5)) ||
    (water !== undefined && water < 10 &&
      moisture !== undefined && moisture < 35) ||
    (ph !== undefined && (ph < 4.5 || ph > 8.5))

  const status = criticalCondition || score < 55
    ? 'danger'
    : score < 80
      ? 'warning'
      : 'good'

  const label = status === 'danger'
    ? 'YOUR FARM IS BAD'
    : status === 'warning'
      ? 'YOUR FARM IS FAIR'
      : 'YOUR FARM IS GOOD'

  return {
    label,
    status,
    score,
    criticalCondition
  }
}

function getFarmHealthReasons() {
  return sensors
    .filter(sensor => sensor.configured !== false && Number.isFinite(Number(sensor.value)))
    .map(sensor => {
      const condition = getFarmerCondition(sensor)
      if (condition.status !== 'danger') return null

      const explanations = {
        'Soil Moisture': {
          title: 'Your soil is too dry',
          message: 'Your crops may not be getting enough water.',
          action: 'Water the crops and check the soil again.'
        },
        'Air Quality': {
          title: 'Air quality needs attention',
          message: 'The air sensor is showing a poor reading.',
          action: 'Check the sensor and the air around your farm.'
        },
        'Soil Quality': {
          title: 'Your soil needs care',
          message: 'The soil quality score is low. The soil may need better care.',
          action: 'Check the soil moisture, temperature and pH.'
        },
        'Water Tank Level': {
          title: 'Your water is running low',
          message: 'There may not be enough water for your crops.',
          action: 'Refill your water tank.'
        },
        'Water Level': {
          title: 'Your water is running low',
          message: 'There may not be enough water for your crops.',
          action: 'Refill your water tank.'
        }
      }

      return {
        sensor: sensor.name,
        condition: condition.label,
        ...(explanations[sensor.name] || {
          title: sensor.name + ' needs attention',
          message: 'This sensor is showing a condition that needs attention.',
          action: 'Check this part of your farm.'
        })
      }
    })
    .filter(Boolean)
}

function render() {
  updateSoilQuality()

  const app = document.querySelector('#app')
  const online = state.online
  const pumpOn = state.pumpOn
  const farmHealth = getOverallFarmHealth()

  app.innerHTML = `
    <div class="app">
      ${state.tab !== 'map-drawing' ? `<header class="topbar">
        <img src="/senesmart-logo.png" alt="SeneSmart">
        <div class="sene-assistant-actions">
          <button class="sene-speak-button ${voiceListening ? "is-listening" : ""}" data-action="sene-speak" aria-label="Speak to Sene">
            <span class="sene-speak-icon">${icon("mic", 30)}</span>
          </button>

          <button class="sene-ask-button" data-action="sene-ai">
            <span class="sene-ask-icon">✦</span>
            <span>Ask Sene AI</span>
            <span class="sene-ai-tag">AI</span>
          </button>
        </div>
      </header>` : ''}

      ${state.tab === 'home' ? `
        <button class="farm-health-card ${farmHealth.status}" data-action="analysis" aria-label="Open farm analysis">
          <span>OVERALL FARM HEALTH</span>
          <strong>${farmHealth.label}</strong>
          <span class="farm-health-score">${farmHealth.score === null ? 'Waiting for readings' : `${farmHealth.score}/100`}</span>
          <small>View Analysis →</small>
        </button>
      ` : ''}

      <main class="content">
        ${state.tab !== 'map-drawing' ? `<section class="welcome">
          <div>
            <span class="eyebrow">SMART FARMING</span>
            <h1>${state.tab === 'home' ? 'Farm Overview' : state.tab === 'pump' ? 'Pump Control' : state.tab === 'automation' ? 'Automation' : state.tab === 'analysis' ? 'Farm Analysis' : state.tab === 'map-settings' ? 'Farm Settings' : 'Farm Map'}</h1>
            <p>Your farm, at a glance.</p>
          </div>
        </section>` : ''}

        ${state.tab === 'map-drawing' ? renderMapDrawing() : state.tab === 'sensor-placement' ? renderSensorPlacement() : state.tab === 'home' ? `

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
          </div>

          <section class="sensor-grid">
            ${sensors.map(sensor => {
              const condition = getFarmerCondition(sensor)
              const gauge = getGaugePercent(sensor)

              return `
                <article class="sensor-card card">
                  <p class="sensor-card-title">${sensor.name}</p>
                  ${sensor.calculated ? '<span class="sensor-calculated-note">Calculated from moisture, pH and temperature</span>' : ''}

                  ${sensor.configured === false ? `
                    <div class="sensor-unconfigured">
                      <div class="sensor-unconfigured-icon">${icon(sensor.icon, 27)}</div>
                      <strong>Not configured</strong>
                      <span>Connect the required soil-quality module to enable readings.</span>
                    </div>
                  ` : sensor.name === 'Water Tank Level' ? `
                    <div class="tank-visual">
                      <div class="tank-shell">
                        <div class="tank-water" style="height: ${gauge}%">
                          <div class="tank-wave"></div>
                        </div>
                        <div class="tank-percent">
                          ${sensor.value}<small>%</small>
                        </div>
                      </div>
                    </div>
                  ` : `
                    <div class="sensor-gauge ${condition.status}">
                      <svg viewBox="0 0 100 100" aria-hidden="true">
                        <circle class="gauge-track" cx="50" cy="50" r="42"
                          pathLength="100" />
                        <circle class="gauge-progress" cx="50" cy="50" r="42"
                          pathLength="100"
                          style="--gauge-level: ${gauge};"
                          stroke-dasharray="${gauge} 100" />
                      </svg>
                      <div class="gauge-reading">
                        <strong>${sensor.name === 'Air Quality' ? Math.round(gauge) : sensor.value}</strong>
                        <span>${sensor.unit}</span>
                      </div>
                    </div>
                  `}

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
              <h2>Water Pump</h2>

              <div class="pump-status ${pumpOn ? 'status-running' : ''}">
                <span></span>${pumpOn ? 'PUMP RUNNING' : 'PUMP STOPPED'}
              </div>

              <button class="control-button ${pumpOn ? 'button-stop' : 'button-start'}" data-action="pump">
                ${icon('power', 19)}
                ${pumpOn ? 'Turn Pump OFF' : 'Turn Pump ON'}
              </button>
            </div>

          </section>
        ` : state.tab === 'automation' ? renderAutomation() : state.tab === 'analysis' ? `
          <section class="analysis-page analysis-simple">
            <div class="analysis-simple-summary ${farmHealth.status}">
              <div class="analysis-simple-summary-icon">
                ${icon(farmHealth.status === 'danger' ? 'alert' : farmHealth.status === 'warning' ? 'activity' : 'shield', 27)}
              </div>
              <div>
                <span>YOUR FARM TODAY</span>
                <strong class="analysis-health-score">${farmHealth.score === null ? 'Waiting for readings' : `${farmHealth.score}/100`}</strong>
                <h2>${farmHealth.status === 'danger' ? 'Your farm needs a little help' : farmHealth.status === 'warning' ? 'Your farm needs some care' : 'Your farm is doing well'}</h2>
                <p>${farmHealth.status === 'danger' ? 'Some things on your farm need care. See what you can do below.' : farmHealth.status === 'warning' ? 'A few things need checking. See what to do below.' : 'Your farm is doing well. Keep taking care of it.'}</p>
              </div>
            </div>

            <div class="analysis-simple-heading">
              <h2>How is your farm?</h2>
              <p>See how your farm is doing and what you can do to help.</p>
            </div>

            <div class="analysis-simple-list">
              ${sensors.map(sensor => {
                const condition = getFarmerCondition(sensor)
                const unavailable = sensor.configured === false || !Number.isFinite(Number(sensor.value))
                const status = unavailable ? 'unavailable' : condition.status
                const statusText = unavailable
                  ? 'No reading yet'
                  : status === 'danger'
                    ? 'Needs attention'
                    : status === 'warning'
                      ? 'Check this again soon'
                      : 'Good'

                const reading = unavailable
                  ? 'No reading yet'
                  : sensor.name === 'Air Quality'
                    ? `${getGaugePercent(sensor).toFixed(1)}%`
                    : `${sensor.value}${sensor.unit ? ` ${sensor.unit}` : ''}`

                const advice = {
                  'Soil Moisture': status === 'danger'
                    ? ['Your soil is dry. Your crops may need more water.', 'Water the crops, then check the soil again.']
                    : ['Your soil has enough water.', 'Check the soil again. Water it if it becomes too dry.'],
                  'Temperature': status === 'warning'
                    ? ['It is getting hot, and your crops may need extra care.', 'Check your crops. Give them shade or water if they need it.']
                    : ['The temperature is at a good level for your farm.', 'Check the temperature again later in the day.'],
                  'Humidity': status === 'warning'
                    ? ['There is little moisture in the air. Your crops may need extra care.', 'Check your crops and the moisture in the air.']
                    : ['There is a good amount of moisture in the air.', 'Keep checking the moisture in the air around your crops.'],
                  'Water Tank Level': status === 'danger'
                    ? ['Your water tank has very little water left.', 'Fill the tank before watering your crops.']
                    : status === 'warning'
                      ? ['Your tank is running low on water.', 'Fill the tank soon so you have enough water.']
                      : ['Your tank has enough water.', 'Check the tank so you know when it needs filling.'],
                  'Air Quality': [
                    'This is the reading from your air sensor. It is an indicator, so keep checking it.',
                    'Keep the sensor clean and check that it is connected properly.'
                  ],
                  'Soil pH': status === 'warning'
                    ? ['Your soil may be too acidic or not acidic enough.', 'Test your soil before adding anything to it.']
                    : ['Your soil acidity is at a good level for growing crops.', 'Check your soil acidity from time to time.'],
                  'Soil Quality': status === 'danger'
                    ? ['Your soil may need more care.', 'Check the soil water, temperature and acidity to find the problem.']
                    : status === 'warning'
                      ? ['Your soil may need some attention.', 'Check the soil water, temperature and acidity readings.']
                      : ['Your soil looks healthy based on these readings.', 'Keep checking the soil water, temperature and acidity.']
                }

                const unavailableAdvice = sensor.name === 'Soil Quality'
                  ? ['We cannot check your soil condition yet.', 'Make sure the soil water, temperature and acidity sensors are giving readings.']
                  : ['This sensor is not giving us a reading right now.', 'Check that the sensor is connected properly.']

                const messages = unavailable ? unavailableAdvice : (advice[sensor.name] || [
                  'This reading should be checked regularly.',
                  'Check the sensor and monitor this part of your farm.'
                ])

                const displayName = sensor.name === 'Soil Quality'
                  ? 'Overall soil condition'
                  : sensor.name === 'Humidity'
                    ? 'Moisture in the air'
                    : sensor.name === 'Soil pH'
                      ? 'Soil acidity'
                      : sensor.name

                return `
                  <article class="analysis-simple-card ${status}">
                    <div class="analysis-simple-card-top">
                      <div>
                        <h3>${displayName}</h3>
                        <span class="analysis-simple-status">${statusText}</span>
                      </div>
                      <strong>${reading}</strong>
                    </div>
                    <p>${messages[0]}</p>
                    <div class="analysis-simple-advice">
                      <strong>WHAT TO DO</strong>
                      <p>${messages[1]}</p>
                    </div>
                    ${sensor.name === 'Soil Quality' ? '<small>This result uses the soil water, temperature and acidity readings. You do not need another soil sensor.</small>' : ''}
                  </article>
                `
              }).join('')}
            </div>
          </section>
        ` : state.tab === 'map-settings' ? renderMapSettings() : renderFarmMap()}

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

            ${voiceStatus ? `
              <p class="sene-voice-status" role="status">${escapeChatText(voiceStatus)}</p>
            ` : ''}
            ${voicePartial ? `
              <p class="sene-voice-partial">${escapeChatText(voicePartial)}</p>
            ` : ''}

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

      ${state.tab !== 'map-drawing' ? `<nav class="bottom-nav">
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
        <button class="${state.tab === 'analysis' ? 'nav-active' : ''}" data-action="analysis">
          ${icon('activity', 21)}
          <span>Analysis</span>
        </button>
      </nav>` : ''}
    </div>
  `
}


function updateVoiceStatus(status, partial = '') {
  voiceStatus = status;
  voicePartial = partial;

  if (aiChatOpen) {
    render();

    const messages = document.getElementById('sene-chat-messages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  }
}

function cleanupVoiceAudio() {
  if (voiceProcessor) {
    voiceProcessor.onaudioprocess = null;
    try { voiceProcessor.disconnect(); } catch {}
    voiceProcessor = null;
  }

  if (voiceSource) {
    try { voiceSource.disconnect(); } catch {}
    voiceSource = null;
  }

  if (voiceMuteGain) {
    try { voiceMuteGain.disconnect(); } catch {}
    voiceMuteGain = null;
  }

  if (voiceStream) {
    voiceStream.getTracks().forEach(track => track.stop());
    voiceStream = null;
  }

  if (voiceAudioContext) {
    const context = voiceAudioContext;
    voiceAudioContext = null;
    context.close().catch(error => {
      console.warn('Could not close microphone audio context:', error);
    });
  }
}

function stopVoskListening() {
  if (!voiceListening) return;

  voiceListening = false;

  if (voiceProcessor) {
    voiceProcessor.onaudioprocess = null;
  }

  if (voiceRecognizerReady()) {
    try {
      voskRecognizer.retrieveFinalResult();
    } catch (error) {
      console.warn('Could not retrieve final speech result:', error);
    }
  }

  cleanupVoiceAudio();
  updateVoiceStatus('Stopped listening.');
}

function voiceRecognizerReady() {
  return Boolean(voskRecognizer && voskClient?.ready);
}

async function ensureVoskLoaded() {
  if (voskClient?.ready) return voskClient;
  if (voskLoadPromise) return voskLoadPromise;

  voskLoadPromise = new Promise((resolve, reject) => {
    const client = new VoskClient({
      modelUrl: '/vosk/model.tar.gz',
      workerUrl: '/vosk/vosk.worker.js',
      wasmUrl: '/vosk/vosk.wasm',
      logLevel: 1
    });

    voskClient = client;

    client.on('load', message => {
      if (message.result) {
        resolve(client);
      } else {
        reject(new Error('Vosk could not load the speech model.'));
      }
    });

    client.on('error', message => {
      reject(new Error(message.error || 'Vosk model loading failed.'));
    });
  }).catch(error => {
    if (voskClient) {
      try { voskClient.terminate(); } catch {}
      voskClient = null;
    }

    voskLoadPromise = null;
    throw error;
  });

  return voskLoadPromise;
}

function createVoskRecognizer(sampleRate) {
  if (voskRecognizer && voskRecognizerSampleRate === sampleRate) {
    return voskRecognizer;
  }

  if (voskRecognizer) {
    try { voskRecognizer.remove(); } catch {}
    voskRecognizer = null;
  }

  voskRecognizer = new voskClient.KaldiRecognizer(sampleRate);
  voskRecognizerSampleRate = sampleRate;

  voskRecognizer.on('partialresult', message => {
    if (!voiceListening) return;

    const partial = message.result?.partial || '';
    const now = Date.now();

    if (now - lastVoiceRender < 250) {
      voicePartial = partial;
      return;
    }

    lastVoiceRender = now;
    updateVoiceStatus('Listening…', partial);
  });

  voskRecognizer.on('result', message => {
    const transcript = message.result?.text?.trim();

    if (transcript) {
      aiMessages.push({ role: 'user', text: transcript });
      aiChatOpen = true;
      updateVoiceStatus(
        voiceListening ? 'Listening…' : 'Speech captured.',
        ''
      );
    } else if (voiceListening) {
      updateVoiceStatus('Listening…', '');
    }
  });

  voskRecognizer.on('error', message => {
    console.error('Vosk recognizer error:', message.error);
    updateVoiceStatus('Speech recognition error: ' + message.error);
  });

  return voskRecognizer;
}

async function toggleVoskListening() {
  if (voiceListening) {
    stopVoskListening();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    aiChatOpen = true;
    updateVoiceStatus('Microphone access is not available in this browser.');
    return;
  }

  // Request microphone permission directly from the button interaction.
  let streamRequest;

  try {
    streamRequest = navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  } catch (error) {
    aiChatOpen = true;
    updateVoiceStatus('Could not request microphone permission: ' + error.message);
    return;
  }

  voiceListening = true;
  aiChatOpen = true;
  voicePartial = '';
  updateVoiceStatus('Requesting microphone permission…');

  try {
    const stream = await streamRequest;

    if (!voiceListening) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }

    voiceStream = stream;
    updateVoiceStatus('Preparing offline speech recognition…');

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error('This browser does not support microphone audio processing.');
    }

    voiceAudioContext = new AudioContextClass();

    if (voiceAudioContext.state === 'suspended') {
      await voiceAudioContext.resume();
    }

    if (!voiceListening) {
      cleanupVoiceAudio();
      return;
    }

    await ensureVoskLoaded();

    if (!voiceListening) {
      cleanupVoiceAudio();
      return;
    }

    const sampleRate = voiceAudioContext.sampleRate;
    const recognizer = createVoskRecognizer(sampleRate);

    voiceSource = voiceAudioContext.createMediaStreamSource(voiceStream);
    voiceProcessor = voiceAudioContext.createScriptProcessor(4096, 1, 1);
    voiceMuteGain = voiceAudioContext.createGain();

    // Keep the audio processor active without playing microphone audio aloud.
    voiceMuteGain.gain.value = 0;

    voiceProcessor.onaudioprocess = event => {
      if (!voiceListening || !voskRecognizer) return;

      const channel = event.inputBuffer.getChannelData(0);
      const audioChunk = new Float32Array(channel.length);
      audioChunk.set(channel);

      try {
        voskRecognizer.acceptWaveformFloat(audioChunk, sampleRate);
      } catch (error) {
        console.error('Could not process microphone audio:', error);
      }
    };

    voiceSource.connect(voiceProcessor);
    voiceProcessor.connect(voiceMuteGain);
    voiceMuteGain.connect(voiceAudioContext.destination);

    updateVoiceStatus('Listening… Speak clearly into your microphone.');

  } catch (error) {
    console.error('SeneSmart voice input failed:', error);

    voiceListening = false;
    cleanupVoiceAudio();

    updateVoiceStatus(
      'Voice input failed: ' + (error.message || 'Unknown error')
    );
  }
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



function getDrawingPoint(event, area) {
  const rect = area.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
  };
}

function saveMapDrawings() {
  try {
    localStorage.setItem('senesmart-map-drawings', JSON.stringify(state.mapDrawings));
    return true;
  } catch (error) {
    console.error('Could not save map drawings:', error);
    return false;
  }
}

function renderActiveDrawing() {
  const layer = document.getElementById('active-drawing-layer');
  if (!layer || !activeMapDrawing) return;

  const d = activeMapDrawing;
  const color = d.color;

  if (d.type === 'pen') {
    const points = d.points.map(p => `${p.x * 10},${p.y * 7}`).join(' ');
    layer.innerHTML = `<polyline points="${points}" fill="none"
      stroke="${color}" stroke-width="3" stroke-linecap="round"
      stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  } else {
    const x = Math.min(d.start.x, d.current.x) * 10;
    const y = Math.min(d.start.y, d.current.y) * 7;
    const w = Math.abs(d.current.x - d.start.x) * 10;
    const h = Math.abs(d.current.y - d.start.y) * 7;

    layer.innerHTML = d.type === 'rect'
      ? `<rect x="${x}" y="${y}" width="${w}" height="${h}"
          fill="${color}" fill-opacity=".16" stroke="${color}"
          stroke-width="3" vector-effect="non-scaling-stroke"/>`
      : `<ellipse cx="${x + w / 2}" cy="${y + h / 2}"
          rx="${w / 2}" ry="${h / 2}" fill="${color}"
          fill-opacity=".16" stroke="${color}" stroke-width="3"
          vector-effect="non-scaling-stroke"/>`;
  }
}

function eraseDrawingAt(point) {
  let nearestIndex = -1;
  let nearestDistance = Infinity;

  state.mapDrawings.forEach((drawing, index) => {
    let distance = Infinity;

    if (drawing.type === 'pen') {
      for (const p of drawing.points || []) {
        distance = Math.min(distance, Math.hypot(p.x - point.x, p.y - point.y));
      }
    } else {
      const cx = drawing.x + drawing.w / 2;
      const cy = drawing.y + drawing.h / 2;
      distance = Math.hypot(cx - point.x, cy - point.y);
    }

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  if (nearestIndex !== -1 && nearestDistance < 5) {
    state.mapDrawings.splice(nearestIndex, 1);
    saveMapDrawings();
    render();
  }
}

document.addEventListener('pointerdown', event => {
  const mapArea = event.target.closest('.simple-map-area');

  if (
    mapArea &&
    mapArea.classList.contains('sensor-placement-canvas') &&
    !event.target.closest('[data-placement-marker]') &&
    !state.drawMode &&
    state.tab === 'sensor-placement' &&
    state.placingSensor
  ) {
    event.preventDefault();

    const rect = mapArea.getBoundingClientRect();
    const x = Math.min(97, Math.max(3, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(97, Math.max(3, ((event.clientY - rect.top) / rect.height) * 100));
    const id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `placement-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const placement = {
      id,
      type: state.placingSensor,
      x,
      y
    };

    state.pendingSensorPositions.push(placement);
    state.sensorPositions = [...state.pendingSensorPositions];
    state.selectedSensor = id;

    render();
    return;
  }

  const area = event.target.closest('.map-drawing-area');
  if (!area || !state.drawMode || drawingPointerId !== null) return;

  event.preventDefault();
  drawingPointerId = event.pointerId;
  area.setPointerCapture(event.pointerId);

  const point = getDrawingPoint(event, area);

  if (state.drawingTool === 'eraser') {
    eraseDrawingAt(point);
    drawingPointerId = null;
    return;
  }

  activeMapDrawing = {
    type: state.drawingTool,
    color: state.drawingColor,
    zoneName: state.drawingZoneName,
    points: state.drawingTool === 'pen' ? [point] : undefined,
    start: point,
    current: point
  };

  if (state.drawingTool === 'pen') {
    state.mapDrawings.push(activeMapDrawing);
  }

  renderActiveDrawing();
});

document.addEventListener('pointermove', event => {
  if (event.pointerId !== drawingPointerId || !activeMapDrawing) return;

  const area = document.querySelector('.map-drawing-area');
  if (!area) return;

  event.preventDefault();
  const point = getDrawingPoint(event, area);
  activeMapDrawing.current = point;

  if (activeMapDrawing.type === 'pen') {
    const previous = activeMapDrawing.points[activeMapDrawing.points.length - 1];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.15) {
      activeMapDrawing.points.push(point);
    }
  }

  renderActiveDrawing();
});

function finishMapStroke(event) {
  if (event.pointerId !== drawingPointerId) return;

  if (activeMapDrawing) {
    const drawing = activeMapDrawing;

    if (drawing.type !== 'pen') {
      const x = Math.min(drawing.start.x, drawing.current.x);
      const y = Math.min(drawing.start.y, drawing.current.y);
      const w = Math.abs(drawing.current.x - drawing.start.x);
      const h = Math.abs(drawing.current.y - drawing.start.y);

      if (w > 0.3 && h > 0.3) {
        state.mapDrawings.push({
          type: drawing.type,
          x, y, w, h,
          color: drawing.color,
          zoneName: drawing.zoneName
        });
      }
    }

    activeMapDrawing = null;
    drawingPointerId = null;
    saveMapDrawings();
    render();
  } else {
    drawingPointerId = null;
  }
}

document.addEventListener('pointerup', finishMapStroke);
document.addEventListener('pointercancel', finishMapStroke);

document.addEventListener('change', event => {
  if (event.target.id === 'drawing-color') {
    state.drawingColor = event.target.value;
  }
});

document.addEventListener('input', event => {
  if (event.target.id === 'drawing-zone-name') {
    state.drawingZoneName = event.target.value;
  }
});

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]')
  if (!button) return

  switch (button.dataset.action) {
    case 'sene-speak':
      toggleVoskListening()
      return

    case 'sene-ai':
      aiChatOpen = true
      break

    case 'close-ai-chat':
      aiChatOpen = false
      break;

    case 'home':
      state.tab = 'home'
      break
    case 'analysis':
      state.tab = 'analysis'
      break
    case 'pump-tab':
      state.tab = 'pump'
      break
    case 'automation':
      state.tab = 'automation'
      break
    case 'map':
      state.tab = 'map'
      state.mapSettingsOpen = false
      break
    case 'map-settings':
      state.tab = 'map-settings'
      break
    case 'start-map-drawing':
      state.previousMapBoundary = state.mapBoundary;
      state.drawMode = true;
      state.tab = 'map-drawing';
      state.mapSettingsOpen = false;
      break
    case 'tool-pen':
      state.drawingTool = 'pen';
      break
    case 'tool-rect':
      state.drawingTool = 'rect';
      break
    case 'tool-circle':
      state.drawingTool = 'circle';
      break
    case 'tool-eraser':
      state.drawingTool = 'eraser';
      break
    case 'undo-map-point':
      state.mapDrawings.pop();
      saveMapDrawings();
      break
    case 'clear-map-drawings':
      drawingPointerId = null;
      activeMapDrawing = null;
      state.mapDrawings = [];
      state.mapBoundary = [];
      try {
        localStorage.removeItem('senesmart-map-drawings');
        localStorage.removeItem('senesmart-farm-boundary');
      } catch (error) {
        console.error('Could not clear saved farm map:', error);
      }
      break
    case 'finish-map-drawing':
      if (saveMapDrawings()) {
        const boundary = state.mapDrawings.find(
          drawing => drawing.type === 'pen' && drawing.zoneName === 'Farm boundary'
        );
        if (boundary && boundary.points.length >= 3) {
          state.mapBoundary = boundary.points;
          localStorage.setItem('senesmart-farm-boundary', JSON.stringify(state.mapBoundary));
        }
        state.drawMode = false;
        state.previousMapBoundary = null;

        if (state.pendingSensorPositions === null) {
          state.sensorPositionsOriginal = JSON.parse(JSON.stringify(state.sensorPositions));
          state.pendingSensorPositions = [];
        }

        state.placingSensor = null;
        state.tab = 'sensor-placement';
      }
      break
    case 'cancel-map-drawing':
      drawingPointerId = null;
      activeMapDrawing = null;
      state.mapBoundary = state.previousMapBoundary;
      state.previousMapBoundary = null;
      state.drawMode = false;
      state.tab = 'map-settings';
      break
    case 'place-sensor-s1':
    case 'place-sensor-s2':
    case 'place-sensor-s3':
    case 'place-sensor-s4':
    case 'place-sensor-s5':
    case 'place-sensor-s6':
    case 'place-sensor-s7':
      if (state.pendingSensorPositions === null) {
        state.sensorPositionsOriginal = JSON.parse(JSON.stringify(state.sensorPositions));
        state.pendingSensorPositions = [];
      }
      state.placingSensor = button.dataset.action.slice(-2).toUpperCase();
      state.tab = 'sensor-placement';
      state.mapSettingsOpen = false;
      break;
    case 'add-another-sensor':
      if (state.pendingSensorPositions === null) {
        state.sensorPositionsOriginal = JSON.parse(JSON.stringify(state.sensorPositions));
        state.pendingSensorPositions = [];
      }
      state.placingSensor = null;
      state.tab = 'sensor-placement';
      break;
    case 'select-placement':
      state.selectedSensor = button.dataset.placementId;
      break;
    case 'save-sensor-locations':
      try {
        state.sensorPositions = [...(state.pendingSensorPositions || [])];
        localStorage.setItem('senesmart-sensor-positions', JSON.stringify(state.sensorPositions));
        state.sensorPositionsOriginal = null;
        state.pendingSensorPositions = null;
        state.placingSensor = null;
        state.tab = 'map-settings';
      } catch (error) {
        console.error('Could not save sensor positions:', error);
        alert('Could not save sensor locations. Please try again.');
      }
      break;
    case 'cancel-sensor-locations':
    case 'cancel-sensor-placement':
      if (state.sensorPositionsOriginal !== null) {
        state.sensorPositions = state.sensorPositionsOriginal;
      }
      state.sensorPositionsOriginal = null;
      state.pendingSensorPositions = null;
      state.placingSensor = null;
      state.tab = 'map-settings';
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
