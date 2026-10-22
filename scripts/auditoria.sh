#!/bin/bash

set -u

cd "$(dirname "$0")/.." || exit 1

PORTA="${PORT:-3018}"
BASE_URL="${1:-http://localhost:$PORTA}"
LOG="auditoria_final.log"
TEMP_LOG="/tmp/binario_crud_$$.log"

: > "$LOG"
exec > >(tee -a "$LOG") 2>&1

echo "=========================================="
echo " AUDITORIA FINAL - BINÁRIO TECH"
echo "=========================================="
echo "Data: $(date)"
echo "URL: $BASE_URL"

FALHAS=0

echo
echo "[1] Verificando sintaxe do servidor..."

if node --check server.js; then
  echo "OK: server.js"
else
  echo "FALHA: sintaxe do server.js"
  FALHAS=$((FALHAS + 1))
fi

echo
echo "[2] Verificando sintaxe dos scripts..."

for SCRIPT in scripts/*.sh; do
  if bash -n "$SCRIPT"; then
    echo "OK: $SCRIPT"
  else
    echo "FALHA: $SCRIPT"
    FALHAS=$((FALHAS + 1))
  fi
done

echo
echo "[3] Validando arquivo JSON..."

if jq empty dados/frota.json; then
  echo "OK: dados/frota.json"
else
  echo "FALHA: JSON inválido"
  FALHAS=$((FALHAS + 1))
fi

echo
echo "[4] Testando endpoint de saúde..."

STATUS=$(curl -s -o /tmp/health_binario.json -w "%{http_code}" \
  "$BASE_URL/api/v1/health")

cat /tmp/health_binario.json
echo
echo "HTTP: $STATUS"

if [ "$STATUS" != "200" ]; then
  echo "FALHA no endpoint de saúde."
  FALHAS=$((FALHAS + 1))
fi

echo
echo "[5] Executando testes CRUD..."

if LOG="$TEMP_LOG" bash scripts/teste_crud.sh "$BASE_URL"; then
  echo "OK: testes CRUD"
else
  echo "FALHA: testes CRUD"
  FALHAS=$((FALHAS + 1))
fi

echo
echo "[6] Executando testes de segurança..."

if bash scripts/teste_seguranca.sh "$BASE_URL"; then
  echo "OK: testes de segurança"
else
  echo "FALHA: testes de segurança"
  FALHAS=$((FALHAS + 1))
fi

rm -f "$TEMP_LOG"

echo
echo "=========================================="

if [ "$FALHAS" -eq 0 ]; then
  echo "RESULTADO: TODOS OS TESTES PASSARAM"
else
  echo "RESULTADO: $FALHAS TESTE(S) COM FALHA"
fi

echo "Relatório: $LOG"
echo "=========================================="

if [ "$FALHAS" -ne 0 ]; then
  exit 1
fi
