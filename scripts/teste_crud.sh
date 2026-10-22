#!/bin/bash

set -u

BASE_URL="${1:-http://localhost:${PORT:-3018}}"
PLACA="TESTE-$(date +%s)-$$"

echo "=========================================="
echo " TESTE CRUD - BINÁRIO TECH"
echo "=========================================="

echo
echo "[1] Criando veículo..."

RESPOSTA=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/veiculos" \
  -H "Content-Type: application/json" \
  -d "{\"placa\":\"$PLACA\",\"montadora\":\"Volvo\",\"modelo\":\"FH 540\"}")

CORPO=$(printf '%s\n' "$RESPOSTA" | sed '$d')
STATUS=$(printf '%s\n' "$RESPOSTA" | tail -n 1)

echo "$CORPO"
echo "HTTP: $STATUS"

if [ "$STATUS" != "201" ]; then
  echo "FALHA ao criar veículo."
  exit 1
fi

ID=$(printf '%s' "$CORPO" | jq -r '.id')

if [ -z "$ID" ] || [ "$ID" = "null" ]; then
  echo "FALHA: não foi possível obter o ID do veículo."
  exit 1
fi

echo
echo "[2] Consultando veículo ID $ID..."

STATUS=$(curl -s -o /tmp/veiculo_consultado.json -w "%{http_code}" \
  "$BASE_URL/api/v1/veiculos/$ID")

cat /tmp/veiculo_consultado.json
echo
echo "HTTP: $STATUS"

if [ "$STATUS" != "200" ]; then
  echo "FALHA ao consultar veículo."
  exit 1
fi

echo
echo "[3] Atualizando parcialmente o status..."

STATUS=$(curl -s -o /tmp/veiculo_atualizado.json -w "%{http_code}" \
  -X PATCH "$BASE_URL/api/v1/veiculos/$ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"EM_ROTA"}')

cat /tmp/veiculo_atualizado.json
echo
echo "HTTP: $STATUS"

if [ "$STATUS" != "200" ]; then
  echo "FALHA ao atualizar veículo."
  exit 1
fi

echo
echo "[4] Atualizando o veículo completamente..."

STATUS=$(curl -s -o /tmp/veiculo_put.json -w "%{http_code}" \
  -X PUT "$BASE_URL/api/v1/veiculos/$ID" \
  -H "Content-Type: application/json" \
  -d "{\"placa\":\"$PLACA\",\"montadora\":\"Volvo\",\"modelo\":\"FH 540 Atualizado\",\"status\":\"DISPONIVEL\"}")

cat /tmp/veiculo_put.json
echo
echo "HTTP: $STATUS"

if [ "$STATUS" != "200" ]; then
  echo "FALHA ao atualizar veículo com PUT."
  exit 1
fi

echo
echo "[5] Listando veículos..."

STATUS=$(curl -s -o /tmp/lista_veiculos.json -w "%{http_code}" \
  "$BASE_URL/api/v1/veiculos")

cat /tmp/lista_veiculos.json
echo
echo "HTTP: $STATUS"

if [ "$STATUS" != "200" ]; then
  echo "FALHA ao listar veículos."
  exit 1
fi

echo
echo "[6] Excluindo veículo de teste..."

STATUS=$(curl -s -o /tmp/veiculo_excluido.json -w "%{http_code}" \
  -X DELETE "$BASE_URL/api/v1/veiculos/$ID")

cat /tmp/veiculo_excluido.json
echo
echo "HTTP: $STATUS"

if [ "$STATUS" != "200" ]; then
  echo "FALHA ao excluir veículo."
  exit 1
fi

echo
echo "[7] Confirmando que o veículo foi removido..."

STATUS=$(curl -s -o /tmp/veiculo_removido.json -w "%{http_code}" \
  "$BASE_URL/api/v1/veiculos/$ID")

cat /tmp/veiculo_removido.json
echo
echo "HTTP: $STATUS"

if [ "$STATUS" != "404" ]; then
  echo "FALHA: era esperado HTTP 404 após a exclusão."
  exit 1
fi

echo
echo "SUCESSO: todos os testes CRUD passaram."
