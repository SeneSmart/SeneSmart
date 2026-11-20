import asyncio
import json
import os
import math
from datetime import datetime, timezone
from websockets.asyncio.server import serve

HOST = "0.0.0.0"
TCP_PORT = 9000
WS_PORT = 9001
MAX_MESSAGE_SIZE = 4096

DEVICE_TOKEN = os.environ.get("SENESMART_DEVICE_TOKEN")

connected_devices = {}
dashboard_clients = set()
latest_readings = {}

def log(message):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{now}] {message}", flush=True)

def validate_reading(message, device_id):
    if not isinstance(message, dict):
        return None
    if message.get("type") != "reading":
        return None
    if message.get("device_id") != device_id:
        return None

    sensors = message.get("sensors")
    if not isinstance(sensors, dict) or not sensors or len(sensors) > 30:
        return None

    clean_sensors = {}
    for name, value in sensors.items():
        if not isinstance(name, str) or not name:
            return None
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return None
        if not math.isfinite(value):
            return None
        clean_sensors[name[:50]] = value

    return {
        "device_id": device_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sensors": clean_sensors
    }

async def broadcast(data):
    if not dashboard_clients:
        return

    payload = json.dumps(data)
    clients = list(dashboard_clients)

    results = await asyncio.gather(
        *(client.send(payload) for client in clients),
        return_exceptions=True
    )

    for client, result in zip(clients, results):
        if isinstance(result, Exception):
            dashboard_clients.discard(client)

async def dashboard_handler(websocket):
    dashboard_clients.add(websocket)
    log("Dashboard connected")

    try:
        await websocket.send(json.dumps({
            "type": "initial",
            "devices": list(latest_readings.values()),
            "connected_devices": list(connected_devices.keys())
        }))

        await websocket.wait_closed()
    finally:
        dashboard_clients.discard(websocket)
        log("Dashboard disconnected")

async def handle_device(reader, writer):
    address = writer.get_extra_info("peername")
    device_id = None
    connection_id = id(writer)

    log(f"Incoming device connection: {address}")

    try:
        raw = await asyncio.wait_for(reader.readline(), timeout=15)

        if not raw or len(raw) > MAX_MESSAGE_SIZE:
            return

        hello = json.loads(raw.decode("utf-8"))

        if not isinstance(hello, dict) or hello.get("type") != "hello":
            return

        device_id = hello.get("device_id")
        token = hello.get("token")

        if not isinstance(device_id, str) or not 1 <= len(device_id) <= 64:
            return

        if not DEVICE_TOKEN or token != DEVICE_TOKEN:
            log(f"Authentication rejected: {address}")
            writer.write(b'{"type":"error","message":"unauthorized"}\n')
            await writer.drain()
            return

        connected_devices[device_id] = connection_id

        writer.write(b'{"type":"authenticated"}\n')
        await writer.drain()

        log(f"Device authenticated: {device_id}")

        await broadcast({
            "type": "device_status",
            "device_id": device_id,
            "status": "online"
        })

        while True:
            raw = await reader.readline()

            if not raw:
                break

            if len(raw) > MAX_MESSAGE_SIZE:
                break

            try:
                message = json.loads(raw.decode("utf-8"))
                reading = validate_reading(message, device_id)

                if reading is None:
                    writer.write(b'{"type":"error","message":"invalid_reading"}\n')
                    await writer.drain()
                    continue

                latest_readings[device_id] = reading

                log(f"Sensor data: {json.dumps(reading)}")

                await broadcast({
                    "type": "reading",
                    **reading
                })

                response = {
                    "type": "ack",
                    "device_id": device_id,
                    "received": True
                }

                writer.write((json.dumps(response) + "\n").encode())
                await writer.drain()

            except (json.JSONDecodeError, UnicodeDecodeError):
                writer.write(b'{"type":"error","message":"invalid_json"}\n')
                await writer.drain()

    except asyncio.TimeoutError:
        log(f"Connection timeout: {address}")
    except (ConnectionError, OSError) as error:
        log(f"Connection error: {error}")
    except Exception as error:
        log(f"Unexpected error: {error}")
    finally:
        if device_id and connected_devices.get(device_id) == connection_id:
            del connected_devices[device_id]
            log(f"Device disconnected: {device_id}")

            await broadcast({
                "type": "device_status",
                "device_id": device_id,
                "status": "offline"
            })

        writer.close()
        try:
            await writer.wait_closed()
        except ConnectionError:
            pass

async def main():
    if not DEVICE_TOKEN:
        raise RuntimeError("SENESMART_DEVICE_TOKEN is not configured.")

    tcp_server = await asyncio.start_server(
        handle_device,
        HOST,
        TCP_PORT,
        limit=MAX_MESSAGE_SIZE + 1
    )

    ws_server = await serve(
        dashboard_handler,
        HOST,
        WS_PORT,
        max_size=MAX_MESSAGE_SIZE
    )

    log(f"TCP device server listening on {HOST}:{TCP_PORT}")
    log(f"Dashboard WebSocket listening on {HOST}:{WS_PORT}")
    log("Waiting for devices and dashboard connections...")

    async with tcp_server:
        async with ws_server:
            await asyncio.gather(
                tcp_server.serve_forever(),
                ws_server.serve_forever()
            )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log("SeneSmart server stopped.")
