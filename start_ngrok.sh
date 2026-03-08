#!/bin/bash

# Start ngrok to expose the Vite dev server
# --host-header=localhost:5173 is required so Vite accepts the forwarded request

echo "Starting ngrok tunnel for Vite dev server (port 5173)..."
echo "You can view the ngrok dashboard at http://localhost:4040\n"

ngrok http 5173 --host-header=localhost:5173
