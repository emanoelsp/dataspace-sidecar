# Dataspace Sidecar (PEP)

O **Sidecar Proxy** é o *Policy Enforcement Point* (PEP) da arquitetura de
Dataspace intraorganizacional — o "conector leve" que roda **na borda, junto dos
CPS**. Ele valida os tokens emitidos pelo Dataspace (nuvem), faz o proxy P2P para
os equipamentos na rede local e registra os acessos. **O dado nunca passa pela
nuvem** — só o token é negociado lá.

```
consumidor ──(dados P2P)──►  SIDECAR PEP  ──(LAN)──►  CPS
                                  ▲
                                  └──(token via HTTPS)── Dataspace (nuvem)
```

## Quem roda isto

Quem **provê dados** (tem CPS na rede) roda um Sidecar. Um único Sidecar atende
vários CPS da mesma rede. Ele é **stateful** (guarda tokens em `.data/`) e precisa
alcançar os CPS pela LAN — por isso **não** roda em serverless/Vercel.

## Requisitos
- Node.js 18+ (recomendado 20+)

## Instalação e execução

```bash
git clone https://github.com/emanoelsp/dataspace-sidecar.git
cd dataspace-sidecar
cp .env.local.example .env.local     # edite o SIDECAR_ADMIN_SECRET
npm install
npm run dev                          # sobe em http://localhost:3100
```

`SIDECAR_ADMIN_SECRET` **tem que ser igual** ao configurado no Dataspace —
é com ele que a nuvem registra equipamentos e empurra tokens.

Teste local:
```bash
curl http://localhost:3100/api/status
```

## Expor o Sidecar para a nuvem (cloudflared)

O Dataspace (nuvem) precisa alcançar o Sidecar para empurrar tokens. Como o
Sidecar está na tua LAN, exponha-o com um túnel público:

```bash
# sem cadastro (URL efêmero, muda a cada reinício)
cloudflared tunnel --url http://localhost:3100
# → https://algo.trycloudflare.com   ← este é o sidecarEndpoint

# alternativa: ngrok http 3100
```

Use esse URL público como `sidecarEndpoint` ao registrar os CPS no Dataspace
(`POST /api/m2m/register`). O mesmo URL serve para a nuvem empurrar o token e
para os consumidores buscarem os dados pelo PEP.

> URL fixo (para testes de vários dias): use um *named tunnel* do cloudflared
> (requer conta Cloudflare + domínio). Com o URL efêmero, se ele mudar, basta
> re-registrar os CPS (o register é idempotente).

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/status` | saúde do PEP + equipamentos registrados + estatísticas de tokens |
| GET/POST/PATCH | `/api/equipment` | registro dinâmico de CPS (admin secret) |
| POST | `/api/tokens` | recebe token do Dataspace (admin secret) |
| PATCH | `/api/tokens/:id` | revoga token (admin secret) |
| GET | `/api/proxy/{slug}/{data\|aas\|resourceId}` | **consumo P2P** — valida o Bearer token e faz proxy ao CPS |
| GET | `/api/access-log` | trilha de acessos (admin secret) |

## Recursos de dados do CPS

Um CPS pode expor vários recursos na mesma API (ex.: 5 catálogos). O Dataspace
registra cada um com `id` e `path` no `POST /api/equipment`:

```json
{ "id": "cpslai1", "name": "CPS-LAI-01", "baseUrl": "http://127.0.0.1:3101",
  "resources": [
    { "id": "operational", "name": "Operational Data", "path": "/api/v1/operational" },
    { "id": "hcm-episodes", "name": "HCM Episodes", "path": "/api/v1/hcm/episodes" }
  ] }
```

O consumidor chama `GET /api/proxy/cpslai1/operational` (query string repassada) e
o PEP encaminha para `{baseUrl}/api/v1/operational`. O token só passa se o
contrato liberou aquele recurso (`permissions` contém o `id`). `data` e `aas`
continuam mapeados para `/api/data` e `/api/aas`.

## Segredo do Sidecar

Para CPS registrados via M2M, o `SIDECAR_ADMIN_SECRET` é **o segredo da tua
organização**, não um valor global: no primeiro `POST /api/m2m/register` da
organização, envie o valor do `.env.local` no header `X-Sidecar-Secret` (≥ 32
caracteres) — ou deixe o Dataspace gerar e copie `sidecarSecret` da resposta.

## Testes

```bash
npm test   # node --test (Node 23.6+, que executa .ts nativamente)
```

## Relação com os outros repositórios
- **Control plane (nuvem):** `dataspace_v2` → `dataspaceapp` (catálogo, governança, tokens).
- **Simuladores de CPS:** `dataspace-equipment` (para testes/métricas).
