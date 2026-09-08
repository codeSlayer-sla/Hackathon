# Demo en 3 laptops (P2P real, no simulado)

Esto reparte la mesh en tres máquinas físicas distintas, para que ninguna
cargue con casi todo (ver el comentario en `docker-compose.node-a.yml`
para el porqué de este reparto exacto). RAM aproximada por laptop una vez
todo cargado: **Node A ~4.5-5GB, Node B y Node C ~3.5-4GB cada una**
(contra ~8-9GB si todo va en una sola máquina).

| Laptop | Rol | Corre |
|---|---|---|
| **Node A** | Enterprise | `router`, `rag`, `frontend`, `installed-base`, `peer-vision`, `peer-voice` |
| **Node B** | Medium Provider | `peer-medium` |
| **Node C** | GPU/Large Provider | `peer-gpu` |

`peer-vision`/`peer-voice` quedan fijos en Node A porque leen los mismos
archivos (fotos/audio) que sube `installed-base` vía el volumen Docker
`media-data` — un volumen es local a una sola laptop, no cruza a otra.
`peer-medium`/`peer-gpu` son puro texto (la pregunta viaja completa en el
JSON), así que son los únicos que se pueden mover de máquina sin tocar
código.

**¿Solo 2 laptops disponibles?** Fusioná Node B en Node A: agregá el
servicio `peer-medium` de `docker-compose.node-b.yml` dentro de
`docker-compose.node-a.yml` (mismo `ROUTER_URL: http://router:8000`
interno, sin IP de LAN) y corré Node C aparte como está.

## 1. Conectar las tres laptops a la misma red

Mismo WiFi/LAN. Redes de invitado separadas o VPNs corporativas distintas
probablemente no se ven entre sí — usar un hotspot propio si hace falta.

## 2. Encontrar la IP de Node A

En Node A:

```powershell
ipconfig | findstr /R "IPv4"
```

o en bash/WSL:

```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
```

Anotá la IP tipo `192.168.x.x` (la de la interfaz Wi-Fi/Ethernet real, no
`127.0.0.1` ni una IP virtual de Docker/WSL).

## 3. Levantar Node A

```bash
docker compose -f docker-compose.node-a.yml up --build
```

Verificar desde la propia laptop:

```bash
curl http://localhost:8001/health
```

## 4. Levantar Node B y Node C

En **Node B**:

```bash
cp .env.node-b.example .env.node-b
# editar .env.node-b: ROUTER_HOST=<IP de Node A del paso 2>
docker compose -f docker-compose.node-b.yml --env-file .env.node-b up --build
```

En **Node C**:

```bash
cp .env.node-c.example .env.node-c
# editar .env.node-c: ROUTER_HOST=<IP de Node A del paso 2>
docker compose -f docker-compose.node-c.yml --env-file .env.node-c up --build
```

## 5. Verificar que ambos se registraron

Desde cualquiera de las tres laptops:

```bash
curl http://<ip-de-node-a>:8001/peers
```

Deberían aparecer `peer-medium` y `peer-gpu`, ambos con
`"available": true`. Si falta alguno, ver "Problemas comunes".

## 6. Probar el momento fuerte de la demo

```bash
# Pregunta simple -> resuelta en Node B (peer-medium)
curl -X POST http://<ip-de-node-a>:8001/ask -H "Content-Type: application/json" \
  -d '{"query": "hola"}'

# Pregunta compleja -> el Router la delega a Node C (peer-gpu)
curl -X POST http://<ip-de-node-a>:8001/ask -H "Content-Type: application/json" \
  -d '{"query": "analiza los ultimos 300 incidentes y determina patrones de causa raiz"}'
```

En la segunda, `plan.target_node_id` debería ser `peer-gpu` y
`plan.execution_mode` debería ser `p2p` — la prueba visual de que la
inferencia viajó a una tercera laptop físicamente distinta.

## Problemas comunes

- **`peer-medium`/`peer-gpu` no aparecen en `/peers`**: revisá que
  `ROUTER_HOST` en `.env.node-b`/`.env.node-c` sea la IP correcta (no
  `localhost`), y que el firewall de Node A deje pasar el puerto 8001
  entrante. En Windows: Firewall de Windows Defender → permitir una app →
  Docker Desktop, o crear una regla de entrada para el puerto 8001.
- **El frontend no carga datos desde otro dispositivo**: si alguien abre
  `http://<ip-node-a>:5173` desde OTRA máquina, el frontend fue compilado
  con `VITE_ROUTER_URL=http://localhost:8001` — apunta al `localhost` de
  quien lo abre, no al de Node A. Cambiar esos `args` en
  `docker-compose.node-a.yml` a la IP real de Node A antes de buildear.
- **Todo lento la primera vez**: cada laptop descarga su propio modelo
  (Node A: ~1GB combinados entre rag/vision/voice; Node B: ~740MB;
  Node C: ~740MB) — hacerlo con anticipación, no el día de la demo.
