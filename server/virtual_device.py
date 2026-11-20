import json
import os
import random
import socket
import time

HOST = os.environ.get("SENESMART_SERVER_HOST", "127.0.0.1")
PORT = 9000
DEVICE_ID = "SEN-001"
TOKEN = os.environ.get(
    "SENESMART_DEVICE_TOKEN",
    "SeneSmart-Dev-2026-ChangeMe"
)

sensors = {
    "water_level": 76.0,
    "oxygen_pressure": 2.4,
    "air_quality": 42.0,
    "temperature": 24.8,
    "humidity": 65.0
}

def send_readings(client):
    for name in sensors:
        if name == "water_level":
            sensors[name] = max(0, min(100, sensors[name] + random.uniform(-0.8, 0.8)))
        elif name == "oxygen_pressure":
            sensors[name] = max(0, min(5, sensors[name] + random.uniform(-0.04, 0.04)))
        elif name == "air_quality":
            sensors[name] = max(0, min(500, sensors[name] + random.uniform(-2, 2)))
        elif name == "temperature":
            sensors[name] = max(10, min(50, sensors[name] + random.uniform(-0.2, 0.2)))
        elif name == "humidity":
            sensors[name] = max(0, min(100, sensors[name] + random.uniform(-1, 1)))

    message = {
        "type": "reading",
        "device_id": DEVICE_ID,
        "sensors": {key: round(value, 2) for key, value in sensors.items()}
    }

    client.sendall((json.dumps(message) + "\n").encode())

    response = client.makefile("rb").readline()
    if not response:
        raise ConnectionError("Server closed the connection")

    result = json.loads(response.decode())
    if result.get("type") != "ack":
        raise ConnectionError(f"Unexpected server response: {result}")

    print(
        f"[SEN-001] Water: {sensors['water_level']:.1f}% | "
        f"Oxygen: {sensors['oxygen_pressure']:.2f} bar | "
        f"Air: {sensors['air_quality']:.0f} AQI | "
        f"Temperature: {sensors['temperature']:.1f} C | "
        f"Humidity: {sensors['humidity']:.1f}%"
    )

def run():
    print("SeneSmart virtual device starting...")
    print(f"Device ID: {DEVICE_ID}")
    print(f"Server: {HOST}:{PORT}")

    while True:
        try:
            with socket.create_connection((HOST, PORT), timeout=5) as client:
                client.settimeout(10)
                stream = client.makefile("rb")

                hello = {
                    "type": "hello",
                    "device_id": DEVICE_ID,
                    "token": TOKEN
                }

                client.sendall((json.dumps(hello) + "\n").encode())
                response = json.loads(stream.readline().decode())

                if response.get("type") != "authenticated":
                    raise ConnectionError(f"Authentication failed: {response}")

                print("Connected and authenticated!")

                while True:
                    send_readings(client)
                    time.sleep(3)

        except KeyboardInterrupt:
            print("\nVirtual device stopped.")
            break
        except (OSError, ConnectionError, ValueError) as error:
            print(f"Connection lost: {error}")
            print("Retrying in 5 seconds...")
            time.sleep(5)

if __name__ == "__main__":
    run()
