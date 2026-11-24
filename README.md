# Taller final: API REST de turnos veterinarios

**Asignatura:** Arquitectura cliente / servidor.  
**Programa:** Profesional en Ingeniería de Software, CIAF.  
**Grupo:** jueves.

  
API REST construida con Node.js y Express para registrar y consultar turnos de una clínica veterinaria. Aplica arquitectura por capas, almacenamiento en memoria y una tarifa de atención prioritaria determinada por el número de lista del equipo.

## 1. Integrantes y parámetro N

Los integrantes están ordenados alfabéticamente por apellido, según el listado oficial incluido en el taller:

| Apellidos | Nombres | Número de lista |
| --- | --- | ---: |
| Arbelaez Medina | Johan Andres | 1 |
| Galindo Rodriguez | Luis Eduardo | 10 |
| Parra Murillo | Santiago | 18 |
| Zapata Mejia | Santiago | 24 |

El primer integrante en ese orden es **Johan Andres Arbelaez Medina**, número **1**. Por tanto:

```text
N = 1
porcentajeRecargo = N × 2 = 2 %
```

El archivo `config/equipo.json` contiene los datos del equipo. `services/equipoService.js` ordena sus apellidos y obtiene N del primer integrante; el recargo se calcula en la capa de servicios.

## 2. Caso de negocio: clínica veterinaria

Se eligió el servicio de atención de una **clínica veterinaria**, que recibe solicitudes de consulta y otros servicios para mascotas. Es un caso académico basado en una actividad real, sin atribuir el proyecto a una empresa concreta.

Cada turno identifica al cliente, la mascota, el servicio solicitado, la fecha y hora de atención y el precio base. También indica si requiere atención prioritaria. Para el ejercicio, el precio se expresa en pesos colombianos y admite hasta dos decimales.

| Campo de entrada | Tipo | Regla |
| --- | --- | --- |
| `nombreCliente` | `string` | Obligatorio; no puede estar vacío ni contener solo espacios. |
| `nombreMascota` | `string` | Obligatorio; no puede estar vacío ni contener solo espacios. |
| `tipoServicio` | `string` | Obligatorio; describe el servicio veterinario y no puede estar vacío ni contener solo espacios. |
| `fechaHora` | `string` | Obligatorio; fecha y hora ISO válidas, con zona horaria, por ejemplo `2026-12-01T10:00:00-05:00`. |
| `precioBase` | `number` | Obligatorio; finito, mayor que cero, máximo `1000000000` y hasta dos decimales. |
| `prioritario` | `boolean` | Opcional; acepta `true` o `false`. Si se omite, se considera `false`. |

Los textos se guardan sin espacios al principio ni al final. Una fecha imposible, como el 30 de febrero, se rechaza. Los números enviados como texto y valores como `prioritario: "true"` también se rechazan con 400.

El servidor asigna `id` y calcula `porcentajeRecargo`, `valorRecargo` y `totalPagar`. Si el cliente envía esos campos, se ignoran sus valores. El cuerpo de la petición debe ser un objeto JSON y tiene un límite de 16 KB.

## 3. Regla de negocio

Para un turno prioritario:

```text
porcentajeRecargo = N × 2
valorRecargo = precioBase × porcentajeRecargo / 100
totalPagar = precioBase + valorRecargo
```

Con los datos reales del equipo y un precio base de 100000:

```text
porcentajeRecargo = 1 × 2 = 2 %
valorRecargo = 100000 × 2 / 100 = 2000
totalPagar = 100000 + 2000 = 102000
```

Si `prioritario` es `false` o se omite, el recargo aplicado es cero y `totalPagar = precioBase`. El servicio calcula con centavos enteros y redondea el recargo al centavo más cercano.

## 4. Instalación y ejecución

Requisitos: **Node.js 22 o superior** y npm. Abre una terminal en la carpeta raíz del proyecto, donde está `package.json`:

```bash
npm install
npm start
```

El servidor escucha por defecto en `http://localhost:3000`. Para utilizar otro puerto en Bash:

```bash
PORT=3001 npm start
```

Durante el desarrollo se puede reiniciar automáticamente el servidor al guardar cambios:

```bash
npm run dev
```

Este comando utiliza `node --watch`. Al reiniciar, el arreglo de turnos vuelve a estar vacío.

### Interfaz web: registrar sin comandos

Con `npm start` encendido, abre **http://localhost:3000**. La dirección `/api/turnos` muestra JSON; la raíz `/` abre la aplicación **VetTurnos**.

1. Escribe el nombre del cliente y de la mascota y selecciona el servicio.
2. Elige fecha y hora de atención en horario de Colombia (UTC−5).
3. Ingresa el precio base. Activa **Atención prioritaria** si corresponde.
4. Revisa el resumen: con 100000 y prioridad, el total es 102000. La cotización se calcula en servicios, sin crear una reserva.
5. Pulsa **Registrar turno**. La agenda y los indicadores se actualizan con el registro real devuelto por la API.
6. Usa la búsqueda, los filtros y **Ver detalle** para consultar los turnos. **Actualizar** sincroniza también los registros creados desde curl o un cliente HTTP.

La interfaz no carga datos ficticios. Los registros siguen almacenados en memoria: reiniciar el servidor vacía la agenda. Si el servidor ya estaba abierto cuando agregaste la interfaz, detenlo con Ctrl+C y vuelve a ejecutar `npm start`.

## 5. Estructura y responsabilidades

```text
taller-arquitectura-cliente-servidor/
├── index.js
├── package.json
├── package-lock.json
├── .gitignore
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── config/
│   └── equipo.json
├── routes/
│   └── turnosRoutes.js
├── controllers/
│   ├── turnosController.js
│   └── errorController.js
├── services/
│   ├── equipoService.js
│   └── turnosService.js
├── test/
│   ├── api.test.js
│   ├── servicios.test.js
│   └── interfaz.test.js
├── docs/
│   └── solicitudes.http
└── README.md
```

| Archivo o capa | Responsabilidad |
| --- | --- |
| `index.js` | Inicializar Express, configurar `express.json()`, conectar rutas y controladores de errores, y levantar el servidor. |
| `routes/` | Asociar los métodos y las rutas HTTP con el controlador correspondiente. |
| `controllers/` | Leer `req`, validar entradas y construir `res` con los códigos HTTP apropiados. |
| `services/` | Obtener N, aplicar la regla de recargo, asignar identificadores y gestionar el arreglo de turnos. |
| `public/` | Interfaz en HTML, CSS y JavaScript: formulario, agenda y consultas a la API. Los precios definitivos se calculan en servicios. |
| `config/equipo.json` | Conservar los nombres, apellidos y números oficiales del equipo. |

El flujo de una creación es: cliente HTTP → ruta → controlador y validaciones → servicio y cálculo → respuesta del controlador.

Los datos se almacenan **en un arreglo en memoria** durante la ejecución. No se requiere un motor de base de datos. Al detener o reiniciar el proceso se pierden los turnos y el siguiente identificador vuelve a ser 1.

## 6. Endpoints

| Método | Endpoint | Resultado correcto | Error previsto |
| --- | --- | --- | --- |
| `GET` | `/api/turnos` | 200 y arreglo de turnos, incluso si está vacío. | - |
| `GET` | `/api/turnos/:id` | 200 y turno encontrado. | 404 si el identificador no existe o no tiene un formato válido. |
| `POST` | `/api/turnos` | 201 y turno creado; encabezado `Location` con su URL. | 400 si faltan campos o los datos no son válidos. |

La interfaz añade un endpoint auxiliar, `POST /api/turnos/cotizacion`. Recibe `{"precioBase":100000,"prioritario":true}` y responde 200 con `precioBase`, `prioritario`, `porcentajeRecargo`, `valorRecargo` y `totalPagar`. Comparte las validaciones monetarias y la función de cálculo del registro. **No almacena un turno ni consume identificadores.**

Los errores se devuelven en JSON. Además, un JSON mal formado devuelve 400, un cuerpo mayor de 16 KB devuelve 413 y una ruta desconocida devuelve 404.

## 7. Pruebas manuales y resultados

Ejecuta los ejemplos en una segunda terminal, con `npm start` activo. Para reproducir los identificadores mostrados, comienza con el servidor recién iniciado y sin turnos previos. La opción `-i` de curl muestra el código HTTP junto al cuerpo.

### 7.1. Listar turnos: 200 OK

```bash
curl -i http://localhost:3000/api/turnos
```

Cuerpo de respuesta inicial:

```json
[]
```

### 7.2. Crear un turno prioritario: 201 Created

```bash
curl -i -X POST http://localhost:3000/api/turnos \
  -H 'Content-Type: application/json' \
  --data '{"nombreCliente":"Ana Torres","nombreMascota":"Luna","tipoServicio":"Consulta veterinaria","fechaHora":"2026-12-01T10:00:00-05:00","precioBase":100000,"prioritario":true}'
```

JSON enviado:

```json
{
  "nombreCliente": "Ana Torres",
  "nombreMascota": "Luna",
  "tipoServicio": "Consulta veterinaria",
  "fechaHora": "2026-12-01T10:00:00-05:00",
  "precioBase": 100000,
  "prioritario": true
}
```

La respuesta tiene código **201**, encabezado `Location: /api/turnos/1` y este cuerpo:

```json
{
  "id": 1,
  "nombreCliente": "Ana Torres",
  "nombreMascota": "Luna",
  "tipoServicio": "Consulta veterinaria",
  "fechaHora": "2026-12-01T10:00:00-05:00",
  "precioBase": 100000,
  "prioritario": true,
  "porcentajeRecargo": 2,
  "valorRecargo": 2000,
  "totalPagar": 102000
}
```

### 7.3. Consultar el turno creado: 200 OK

```bash
curl -i http://localhost:3000/api/turnos/1
```

Devuelve **200** y el mismo objeto completo mostrado en la creación. Si se vuelve a consultar `GET /api/turnos`, el arreglo contiene ese objeto.

### 7.4. Rechazar un precio inválido: 400 Bad Request

```bash
curl -i -X POST http://localhost:3000/api/turnos \
  -H 'Content-Type: application/json' \
  --data '{"nombreCliente":"Ana Torres","nombreMascota":"Luna","tipoServicio":"Consulta veterinaria","fechaHora":"2026-12-01T10:00:00-05:00","precioBase":0,"prioritario":true}'
```

JSON enviado:

```json
{
  "nombreCliente": "Ana Torres",
  "nombreMascota": "Luna",
  "tipoServicio": "Consulta veterinaria",
  "fechaHora": "2026-12-01T10:00:00-05:00",
  "precioBase": 0,
  "prioritario": true
}
```

La respuesta tiene código **400** y este cuerpo; el registro no se almacena:

```json
{
  "mensaje": "Datos de entrada inválidos.",
  "errores": [
    "precioBase debe ser un número mayor que cero y menor o igual a 1000000000."
  ]
}
```

### 7.5. Consultar un identificador inexistente: 404 Not Found

```bash
curl -i http://localhost:3000/api/turnos/999
```

Con solo el turno anterior registrado, devuelve **404**:

```json
{
  "mensaje": "Turno no encontrado."
}
```

### 7.6. Crear sin prioridad: 201 Created, sin recargo

Se puede enviar explícitamente `false`:

```json
{
  "nombreCliente": "Carlos Ruiz",
  "nombreMascota": "Max",
  "tipoServicio": "Vacunacion",
  "fechaHora": "2026-12-01T11:00:00-05:00",
  "precioBase": 100000,
  "prioritario": false
}
```

También se puede omitir el atributo:

```json
{
  "nombreCliente": "Laura Gomez",
  "nombreMascota": "Milo",
  "tipoServicio": "Control veterinario",
  "fechaHora": "2026-12-01T12:00:00-05:00",
  "precioBase": 100000
}
```

Cada POST válido devuelve 201 con un nuevo identificador. En ambos casos, estos son los campos de tarifa de la respuesta:

```json
{
  "prioritario": false,
  "porcentajeRecargo": 0,
  "valorRecargo": 0,
  "totalPagar": 100000
}
```

Este último bloque es un extracto; la respuesta completa también contiene el identificador y los datos del turno.

## 8. Pruebas automatizadas

Para ejecutar las pruebas de servicios y HTTP:

```bash
npm test
```

La suite comprueba los cálculos, los estados HTTP, los tipos y campos obligatorios, las fechas inválidas y que una entrada incorrecta no interrumpa el servicio.

El archivo `docs/solicitudes.http` reúne solicitudes manuales que se pueden ejecutar con un cliente compatible con archivos HTTP, como la extensión REST Client de VS Code.

## 9. Verificación de requisitos y entrega

- [x] API REST con Node.js y Express.
- [x] Separación de `index.js`, `routes/`, `controllers/` y `services/`.
- [x] Almacenamiento mediante un arreglo en memoria.
- [x] GET de lista, GET por identificador y POST de creación.
- [x] Respuestas 200, 201, 400 y 404 en JSON.
- [x] Regla de negocio con N = 1 y recargo de equipo del 2 %.
- [x] README con integrantes, negocio y ejemplos JSON de éxito y error.
- [x] `package.json` y `.gitignore` que excluye `node_modules`.
- [x] Pruebas y material para preparar la sustentación.

La entrega en la plataforma y la exposición deben realizarlas los integrantes del equipo.

## Referencia técnica

[Documentación oficial de la API de Express 5](https://expressjs.com/en/5x/api/).
