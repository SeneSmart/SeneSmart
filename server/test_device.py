import socket
import json

HOST = "127.0.0.1"
PORT = 9000
TOKEN = "SeneSmart-Dev-2026-ChangeMe"

device = {
    "type": "hello",
    "device_id": "SEN-001",
    "token": TOKEN
}

readings = {
    "type": "reading",
    "device_id": "SEN-001",
    "sensors": {
        "temperature": 25.6,
        "humidity": 65,
        "water_level": 78,
        "oxygen_pressure": 2.4
    }
}

with socket.create_connection((HOST, PORT), timeout=5) as client:
    client.settimeout(5)

    client.sendall((json.dumps(device) + "\n").encode())
    print("Authentication:", client.recv(1024).decode().strip())

    client.sendall((json.dumps(readings) + "\n").encode())
    print("Sensor response:", client.recv(1024).decode().strip())
