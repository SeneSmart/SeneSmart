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

## 4. Sensor Readings

### GET /sensors/readings/latest

Returns the latest available sensor readings.

Example response:

    {
      "device_id": "SEN-001",
      "soil_moisture": 68.5,
      "temperature": 27.4,
      "humidity": 72,
      "water_level": 85,
      "soil_ph": 6.5,
      "timestamp": "2026-11-20T16:00:00Z"
    }

All measurement values are examples. Actual units, calibration and supported ranges must be confirmed by the hardware team.

## 5. Device Status

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

## 6. Pump Control

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

## 7. Irrigation Automation

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

## 8. Sene AI

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

## 9. Voice Assistant

Proposed voice interaction:

1. The user speaks through the phone microphone.
2. The phone converts speech into text using an agreed speech-recognition method.
3. The text question is sent to the ESP32.
4. Sene AI processes the question locally.
5. The ESP32 returns a text response.
6. The phone reads the response aloud using text-to-speech.

The exact voice-processing responsibilities and offline capabilities must be agreed upon by both teams.

## 10. Communication

The initial proposal is HTTP over the local Wi-Fi network.

The frontend may request updated sensor readings periodically. A five-second interval is a starting proposal, not a fixed requirement.

The hardware team may recommend WebSockets or another suitable method.

## 11. Error Responses

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

## 12. Security

The hardware team should define:

- Device authentication.
- Access control for pump commands.
- Protection against unauthorized local network access.
- Safe handling of invalid or repeated commands.

## 13. Hardware Team Responsibilities

The hardware team is responsible for:

- ESP32 firmware.
- Sensor acquisition and calibration.
- Relay and pump control.
- Irrigation automation.
- Local Sene AI.
- Local API implementation.
- Communication and security.

## 14. Frontend Team Responsibilities

The frontend team is responsible for:

- Mobile-friendly SeneSmart interface.
- Sensor visualization.
- Pump controls.
- Automation settings interface.
- Farm map and sensor indicators.
- Ask Sene AI interface.
- Microphone and spoken response interface.
- Integration with the agreed ESP32 API.

## 15. Items Requiring Team Agreement

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
