# SeneSmart API Specification

Version: 1.0
Status: Proposed — Frontend Development

## 1. Purpose

This document defines how SeneSmart devices will exchange sensor readings
and pump-control commands with the future backend.

The frontend is currently UI-only. These endpoints are specifications,
not implemented API routes.

## 2. Device Identification

Every device must have a unique ID.

Example:
SEN-001

## 3. Sensor Readings

### Endpoint

POST /api/v1/sensors/readings

### Content-Type

application/json

### Example request

{
  "device_id": "SEN-001",
  "timestamp": "2026-11-20T12:30:00Z",
  "sensors": {
    "soil_moisture": 68.5,
    "temperature": 27.4,
    "humidity": 72.0,
    "water_level": 85.0,
    "soil_ph": 6.5
  }
}

### Sensor fields

| Field | Data type | Unit |
|---|---|---|
| soil_moisture | number | % |
| temperature | number | °C |
| humidity | number | % |
| water_level | number | % |
| soil_ph | number | pH |

These are proposed fields. Confirm actual sensor hardware before
finalizing the device implementation.

### Example success response

{
  "success": true,
  "message": "Readings received",
  "device_id": "SEN-001"
}

## 4. Latest Sensor Readings

### Endpoint

GET /api/v1/devices/SEN-001/readings/latest

### Example response

{
  "success": true,
  "device_id": "SEN-001",
  "timestamp": "2026-11-20T12:30:00Z",
  "sensors": {
    "soil_moisture": 68.5,
    "temperature": 27.4,
    "humidity": 72.0,
    "water_level": 85.0,
    "soil_ph": 6.5
  }
}

## 5. Device Status

### Endpoint

GET /api/v1/devices/SEN-001/status

### Example response

{
  "device_id": "SEN-001",
  "connection_status": "online",
  "last_seen": "2026-11-20T12:30:00Z"
}

Possible connection statuses:
- online
- offline

## 6. Pump Control

### Retrieve pending commands

GET /api/v1/devices/SEN-001/commands

### Example response

{
  "success": true,
  "commands": [
    {
      "command_id": "CMD-001",
      "command": "PUMP_CONTROL",
      "state": "ON"
    }
  ]
}

### Pump states

- ON
- OFF

### Command acknowledgement

POST /api/v1/devices/SEN-001/commands/ack

### Example request

{
  "command_id": "CMD-001",
  "device_id": "SEN-001",
  "execution_status": "success",
  "actual_pump_state": "ON"
}

Possible execution statuses:
- success
- failed

The backend must distinguish between a requested pump state and
the actual pump state reported by the Arduino.

## 7. API Authentication

All device requests must use device authentication.

Proposed header:

Authorization: Bearer DEVICE_TOKEN

The actual token must be securely provisioned for each device.
Never hardcode production secrets into public source code.

## 8. Data Validation

The backend should:
- Verify device identity and authentication.
- Validate required fields and data types.
- Reject invalid sensor readings.
- Record the timestamp of each reading.
- Track the last successful device communication.
- Validate pump commands before delivering them.

## 9. Communication Expectations

Proposed initial sensor reporting interval: 5 seconds.

The backend should:
- Accept repeated sensor updates.
- Track offline devices.
- Avoid treating an unacknowledged command as successful.
- Report actual pump state separately from requested state.

## 10. Development Responsibilities

### Arduino C Developer
- Read physical sensors.
- Convert readings into the agreed units.
- Format readings as JSON.
- Send readings to the API.
- Retrieve and execute authorized pump commands.
- Report command execution results.

### Backend Developer
- Implement the endpoints in this specification.
- Authenticate devices.
- Store readings.
- Manage pump commands and acknowledgements.
- Provide data to the frontend.

### Frontend Developer
- Display sensor readings.
- Display device connection status.
- Display pump state.
- Provide pump controls.
- Show errors and stale readings.
- Use demonstration data until the backend is available.

## 11. Important

This document is a proposed interface contract.
Sensor fields, hardware limits, communication protocol, and reporting
frequency must be confirmed with the Arduino developer before production.
