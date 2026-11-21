# SeneSmart API Specification

**Version:** 2.0
**Status:** Proposed — for hardware team review
**Architecture:** Local ESP32 communication

## 1. Overview

This document defines the proposed communication interface between the SeneSmart frontend running on an Android phone and the ESP32 irrigation controller.

The ESP32 is responsible for:
- Reading and processing sensor data.
- Controlling the irrigation pump through a relay.
- Managing irrigation automation.
- Running Sene AI locally.
- Providing sensor readings and device status to the frontend.

The Android phone provides the user interface and communicates with the ESP32 over a local Wi-Fi connection.

These endpoints are proposals. They are not implemented yet.

## 2. System Architecture

1. Android phone — displays the SeneSmart interface.
2. ESP32 — processes sensor readings, pump commands and local AI requests.
3. Sensors — measure farm and environmental conditions.
4. Relay and pump — control water delivery.

## 3. Base URL

The ESP32 will host the local API.

Example:

    http://192.168.4.1/api/v1

The actual IP address and network configuration must be agreed upon by the hardware team.

## 4. Hardware Sensor Mapping

The ESP32 must support these five sensor channels:

| Sensor ID | Sensor | Measurement |
|---|---|---|
| S1 | Soil moisture sensor | Soil moisture percentage |
| S2 | Temperature sensor | Temperature in °C |
| S3 | Humidity sensor | Relative humidity in % |
| S4 | Distance sensor | Water-tank level percentage |
| S5 | Soil pH sensor | Soil pH value |

The ESP32 is responsible for reading, validating and processing all sensor measurements before sending them to the frontend.

## 5. Sensor Readings

### GET /sensors/readings/latest

Returns the latest available sensor readings.

Example response:

    {
      "device_id": "SEN-001",
      "sensors": {
        "S1": {
          "name": "soil_moisture",
          "value": 68.5,
          "unit": "%"
        },
        "S2": {
          "name": "temperature",
          "value": 27.4,
          "unit": "°C"
        },
        "S3": {
          "name": "humidity",
          "value": 72,
          "unit": "%"
        },
        "S4": {
          "name": "water_level",
          "value": 85,
          "unit": "%",
          "distance_cm": 12.5
        },
        "S5": {
          "name": "soil_ph",
          "value": 6.5,
          "unit": "pH"
        }
      },
      "timestamp": "2026-11-20T16:00:00Z"
    }

All values above are examples.

### 4.1 Water Level Calculation — S4

S4 must use a distance-measuring sensor installed above the water tank.

The sensor measures the distance between its mounting position and the water surface.

The ESP32 must convert that distance into a water-level percentage.

Required calibration settings:

- `empty_distance_cm`: measured distance when the tank is empty.
- `full_distance_cm`: measured distance when the tank is full.

Calculation:

    water_level_percent =
      (empty_distance_cm - measured_distance_cm)
      / (empty_distance_cm - full_distance_cm) * 100

The result must be limited to the range 0–100%.

Example:

    empty_distance_cm = 100
    full_distance_cm = 10
    measured_distance_cm = 23.5

    water_level_percent = 85%

The ESP32 must:
- Read the distance sensor.
- Filter invalid or unstable measurements.
- Calculate the water-level percentage.
- Report both the calculated percentage and raw distance.
- Report a sensor error if a valid measurement cannot be obtained.

The tank calibration values must be configurable for the actual tank. Do not hardcode the example values.

The frontend should display the calculated water-level percentage. It should not need to calculate the percentage itself.

### 4.2 Sensor Error Reporting

Each sensor should report whether its reading is valid.

If a sensor fails, the ESP32 should report its status as `error` rather than presenting an invalid measurement as a normal reading.

## 6. Device Status

### GET /device/status

Returns the current ESP32 and irrigation system status.

Example response:

    {
      "device_id": "SEN-001",
      "connected": true,
      "pump_state": "OFF",
      "automation_enabled": false,
      "ai_available": true
    }

## 7. Pump Control

### POST /pump/control

Sends a pump control command to the ESP32.

Example request:

    {
      "command_id": "CMD-001",
      "state": "ON"
    }

Example response:

    {
      "success": true,
      "command_id": "CMD-001",
      "requested_state": "ON",
      "actual_state": "ON",
      "execution_status": "completed"
    }

Supported states:

- ON
- OFF

The ESP32 must report the actual pump state rather than assuming that every command succeeded.

## 8. Irrigation Automation

The frontend is intended to support:

- Scheduled irrigation.
- Soil moisture start and stop thresholds.
- Low-water protection.

The hardware team must define how these settings will be stored, validated and applied by the ESP32.

A proposed endpoint is:

### POST /automation/settings

Example request:

    {
      "schedule_enabled": true,
      "start_time": "06:00",
      "stop_time": "06:30",
      "moisture_enabled": true,
      "moisture_start": 35,
      "moisture_stop": 65,
      "low_water_protection": true
    }

This endpoint is proposed and requires hardware team approval.

## 9. Sene AI

Sene AI is intended to run locally on the ESP32 without depending on a cloud AI service.

### POST /assistant/query

Sends a text question to Sene AI.

Example request:

    {
      "question": "Why is my soil moisture low?"
    }

Example response:

    {
      "success": true,
      "answer": "The soil moisture reading is low. Check the irrigation supply and soil conditions.",
      "source": "local_sene_ai"
    }

The ESP32 team must determine the AI model, supported questions, memory requirements and response format.

## 10. Voice Assistant

Proposed voice interaction:

1. The user speaks through the phone microphone.
2. The phone converts speech into text using an agreed speech-recognition method.
3. The text question is sent to the ESP32.
4. Sene AI processes the question locally.
5. The ESP32 returns a text response.
6. The phone reads the response aloud using text-to-speech.

The exact voice-processing responsibilities and offline capabilities must be agreed upon by both teams.

## 11. Communication

The initial proposal is HTTP over the local Wi-Fi network.

The frontend may request updated sensor readings periodically. A five-second interval is a starting proposal, not a fixed requirement.

The hardware team may recommend WebSockets or another suitable method.

## 12. Error Responses

Example:

    {
      "success": false,
      "error": "DEVICE_UNAVAILABLE",
      "message": "The irrigation controller is not responding."
    }

Suggested error categories:

- DEVICE_UNAVAILABLE
- INVALID_REQUEST
- SENSOR_ERROR
- PUMP_CONTROL_FAILED
- AI_UNAVAILABLE

## 13. Security

The hardware team should define:

- Device authentication.
- Access control for pump commands.
- Protection against unauthorized local network access.
- Safe handling of invalid or repeated commands.

## 14. Hardware Team Responsibilities

The hardware team is responsible for:

- ESP32 firmware.
- Sensor acquisition and calibration.
- Relay and pump control.
- Irrigation automation.
- Local Sene AI.
- Local API implementation.
- Communication and security.

## 15. Frontend Team Responsibilities

The frontend team is responsible for:

- Mobile-friendly SeneSmart interface.
- Sensor visualization.
- Pump controls.
- Automation settings interface.
- Farm map and sensor indicators.
- Ask Sene AI interface.
- Microphone and spoken response interface.
- Integration with the agreed ESP32 API.

## 16. Items Requiring Team Agreement

Before implementation, both teams must confirm:

1. ESP32 Wi-Fi configuration and IP address.
2. Sensor names, units and measurement ranges.
3. API endpoint names and JSON formats.
4. HTTP polling or WebSocket communication.
5. Pump safety and command acknowledgement.
6. Automation settings and execution rules.
7. Local Sene AI capabilities.
8. Voice recognition and text-to-speech responsibilities.
9. Authentication and network security.

---

**SeneSmart — Smart Irrigation and Agricultural Monitoring System**
