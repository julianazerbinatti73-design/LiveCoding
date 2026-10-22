set -u

BASE_URL="${1:-http://localhost:${PORT:-3018}}"
API_KEY="${API_KEY:-binario-tech-secret-2026}"

echo "=========================================="
echo " TESTE DE SEGURANÇA - BINÁRIO TECH"
echo "=========================================="

echo
echo "[1] Testando acesso sem API Key..."

STATUS_SEM_CHAVE=$(curl -s -o /tmp/resposta_sem_chave.json -w "%{http_code}" \
	  "$BASE_URL/api/v1/motoristas")

cat /tmp/resposta_sem_chave.json
echo
echo "HTTP: $STATUS_SEM_CHAVE"

if [ "$STATUS_SEM_CHAVE" != "401" ]; then
	  echo "FALHA: era esperado HTTP 401."
	    exit 1
fi

echo
echo "[2] Testando acesso com API Key..."

STATUS_COM_CHAVE=$(curl -s -o /tmp/resposta_com_chave.json -w "%{http_code}" \
	  -H "X-API-KEY: $API_KEY" \
	    "$BASE_URL/api/v1/motoristas")

cat /tmp/resposta_com_chave.json
echo
echo "HTTP: $STATUS_COM_CHAVE"

if [ "$STATUS_COM_CHAVE" != "200" ]; then
	  echo "FALHA: era esperado HTTP 200."
	    exit 1
fi

echo
echo "SUCESSO: os testes de segurança passaram."
