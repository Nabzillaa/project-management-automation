#!/bin/bash

# Get auth token (assuming default user exists)
echo "=== Getting auth token ==="
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Failed to get auth token. Creating default user..."
  curl -s -X POST http://localhost:3000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"admin123","name":"Admin User"}'
  
  TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"admin123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

echo "Token obtained: ${TOKEN:0:20}..."

# Upload Excel file first (Project Planner - smaller, more structured)
echo ""
echo "=== Uploading Excel file (Project Planner.xlsx) ==="
EXCEL_RESULT=$(curl -s -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/Users/nabilsabih/Downloads/Project Planner.xlsx")

echo "$EXCEL_RESULT" | python3 -m json.tool 2>/dev/null || echo "$EXCEL_RESULT"

# Upload CSV file (JIRA export)
echo ""
echo "=== Uploading CSV file (Jira (31).csv) ==="
CSV_RESULT=$(curl -s -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/Users/nabilsabih/Downloads/Jira (31).csv")

echo "$CSV_RESULT" | python3 -m json.tool 2>/dev/null || echo "$CSV_RESULT"

echo ""
echo "=== Upload complete! ==="
