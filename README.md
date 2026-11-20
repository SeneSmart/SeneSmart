
# SeneSmart 🌱

**Smart Irrigation and Agricultural Monitoring System**

SeneSmart is a smart agriculture project designed to help farmers monitor farm conditions and manage irrigation through a mobile-friendly interface.

## Project Architecture

The system consists of three main components:

1. **Android Phone:** Runs the SeneSmart web frontend.
2. **ESP32:** Handles sensor communication, pump control and local Sene AI processing.
3. **Irrigation Hardware:** Sensors, relays, water pump and connected devices.

The phone and ESP32 are intended to communicate locally over Wi-Fi.

## Main Features

- **Overview:** Monitor soil moisture, temperature, humidity, water level and soil pH.
- **Pump Control:** Monitor and control the irrigation pump.
- **Automation:** Configure irrigation schedules and soil moisture thresholds.
- **Farm Map:** View sensor conditions across the farm.
- **Ask Sene AI:** Type agricultural questions and receive assistance.
- **Voice Assistant:** Speak questions and hear Sene AI responses.
- **Offline AI:** Sene AI is intended to run locally on the ESP32 without cloud AI dependency.

## Technology Stack

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript
- Vite

### Hardware
- ESP32
- Agricultural sensors
- Relay module
- Irrigation pump

### Artificial Intelligence
- Local Sene AI processing on ESP32
- Predetermined agricultural questions
- Sensor-based answers and recommendations

## Project Structure

- `public/` — Public assets and logo
- `src/main.js` — Frontend application
- `src/style.css` — Application styling
- `backups/` — Original React frontend backups
- `API_SPEC.md` — Hardware integration documentation
- `index.html` — Application entry point
- `package.json` — Project dependencies and scripts
- `vite.config.js` — Vite configuration

## Running the Frontend

Requirements: Node.js and npm.

Clone the repository:

    git clone https://github.com/SeneSmart/SeneSmart.git
    cd SeneSmart

Install dependencies:

    npm install

Start development:

    npm run dev

Build for production:

    npm run build

## Hardware Integration

The frontend currently uses demonstration data. It is not yet connected to physical ESP32 hardware.

The hardware team will implement:
- Sensor reading and calibration.
- ESP32 local communication API.
- Pump and relay control.
- Local Sene AI processing.
- Voice-processing integration.

The proposed communication contract is documented in [API_SPEC.md](./API_SPEC.md).

## Team Responsibilities

| Team | Responsibilities |
|---|---|
| Frontend | Mobile interface, sensor displays, pump controls, automation, map and AI interface |
| Hardware | ESP32 firmware, sensors, relay, pump and local AI |
| Integration | Agree on communication formats and connect frontend to ESP32 |

## Development Status

- Frontend: Under development.
- Hardware integration: Pending.
- ESP32 local API: Proposed, not implemented.
- Sene AI: Frontend interface under development; hardware implementation pending.
- Voice assistant: Planned.

---

**SeneSmart — Making irrigation smarter and agriculture more efficient.**
