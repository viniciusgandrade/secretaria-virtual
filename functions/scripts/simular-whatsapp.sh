#!/usr/bin/env bash
# Simula o webhook do gateway de WhatsApp contra a aplicação rodando local.
#
#   npm run start:dev                      # em um terminal
#   ./scripts/simular-whatsapp.sh "oi, quero marcar pre natal"
#
# O telefone é fixo, então as mensagens seguidas caem na MESMA paciente e o
# contexto da conversa acumula — que é justamente o que se quer exercitar.

set -euo pipefail

MENSAGEM="${1:?uso: ./scripts/simular-whatsapp.sh \"mensagem da paciente\"}"
TELEFONE="${TELEFONE:-5561999990000}"
URL="${URL:-http://localhost:3000/bot/webhook}"

curl -sS -X POST "$URL" \
  -H 'Content-Type: application/json' \
  -d "$(cat <<JSON
{
  "sender": { "id": "$TELEFONE" },
  "msgContent": { "conversation": $(printf '%s' "$MENSAGEM" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))') }
}
JSON
)"
echo
