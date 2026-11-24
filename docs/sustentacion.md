# Guía para sustentar la API de turnos

Esta guía organiza la preparación y la demostración del taller. Cada integrante debe poder ejecutar el proyecto, explicar las tres capas y reproducir los estados HTTP, aunque se distribuya la presentación.

## 1. Preparación antes de exponer

1. Abrir una terminal en la raíz del proyecto.
2. Comprobar que esté instalado Node.js 22 o superior: `node --version`.
3. Instalar dependencias con `npm install`.
4. Ejecutar `npm test` y revisar el resultado.
5. Abrir `config/equipo.json`, `index.js`, las rutas, los controladores y los servicios.
6. Tener disponibles dos terminales: una para el servidor y otra para curl. Como alternativa, abrir `docs/solicitudes.http` en un cliente compatible.

Los turnos viven en memoria. Para reproducir la demostración desde cero, detener el servidor con Ctrl+C y volver a ejecutar `npm start`.

## 2. Explicar el problema y el equipo

Presentar el caso de negocio: una clínica veterinaria necesita registrar turnos con cliente, mascota, servicio, fecha y hora, precio base y prioridad. Es un caso académico de un servicio real, sin utilizar una empresa concreta.

Mostrar el equipo del grupo jueves, ordenado por apellidos:

| Orden | Integrante | Número oficial |
| ---: | --- | ---: |
| 1 | Johan Andres Arbelaez Medina | 1 |
| 2 | Luis Eduardo Galindo Rodriguez | 10 |
| 3 | Santiago Parra Murillo | 18 |
| 4 | Santiago Zapata Mejia | 24 |

Explicar que **N = 1** porque corresponde al número de lista del primer integrante por apellido. N no es la cantidad de personas del equipo. El porcentaje de recargo del equipo es **1 × 2 = 2 %**.

## 3. Mostrar las responsabilidades de cada capa

Recorrer los archivos siguiendo el camino de una petición:

1. **`index.js`:** configura Express, `express.json()` con límite de 16 KB, las rutas y los controladores de errores. Luego inicia el servidor.
2. **`routes/turnosRoutes.js`:** asocia GET y POST con sus controladores. No calcula precios ni valida los campos del negocio.
3. **`controllers/turnosController.js`:** lee parámetros y JSON, valida datos y asigna los códigos HTTP. Solo envía al servicio los campos permitidos.
4. **`services/equipoService.js`:** obtiene N del equipo configurado y calcula el porcentaje del equipo.
5. **`services/turnosService.js`:** gestiona el arreglo, asigna identificadores y calcula las tarifas.
6. **`controllers/errorController.js`:** convierte los errores previstos en respuestas JSON y atiende rutas desconocidas.

La regla de tarifa está en servicios porque pertenece al negocio. El controlador se ocupa de la comunicación HTTP y de verificar que la entrada tenga los tipos y valores necesarios.

## 4. Demostración paso a paso

### Registro desde la interfaz

Después de iniciar el servidor, abre **http://localhost:3000**. Completa el formulario con un cliente, una mascota, un servicio, fecha, hora y precio 100000. Activa prioridad para mostrar el recargo del 2 % y el total 102000. Pulsa **Registrar turno**, muestra la reserva en la agenda y abre **Ver detalle**. También demuestra búsqueda y filtros.

Explica que `public/app.js` realiza solicitudes HTTP: la cotización no guarda turnos, el POST de registro crea el recurso y los GET actualizan la agenda y el detalle. El cálculo monetario permanece en `services/turnosService.js`.

Para reproducir los IDs de los siguientes ejemplos desde 1, reinicia el servidor después de esta demostración visual; los datos están en memoria.


En la primera terminal:

```bash
npm start
```

En una segunda terminal, ejecutar las siguientes solicitudes en orden. Los ejemplos suponen un servidor recién iniciado en el puerto 3000.

### Paso 1. Lista vacía: 200

```bash
curl -i http://localhost:3000/api/turnos
```

Se debe observar `200 OK` y `[]`. Una lista vacía es una consulta correcta.

### Paso 2. Crear un turno prioritario: 201

```bash
curl -i -X POST http://localhost:3000/api/turnos \
  -H 'Content-Type: application/json' \
  --data '{"nombreCliente":"Ana Torres","nombreMascota":"Luna","tipoServicio":"Consulta veterinaria","fechaHora":"2026-12-01T10:00:00-05:00","precioBase":100000,"prioritario":true}'
```

Se debe observar `201 Created`, `Location: /api/turnos/1` y un objeto con:

```text
id = 1
precioBase = 100000
porcentajeRecargo = 2
valorRecargo = 2000
totalPagar = 102000
```

Explicar el cálculo en voz alta:

```text
100000 × 2 / 100 = 2000
100000 + 2000 = 102000
```

### Paso 3. Consultar por ID y volver a listar: 200

```bash
curl -i http://localhost:3000/api/turnos/1
curl -i http://localhost:3000/api/turnos
```

La primera consulta devuelve el objeto creado. La segunda devuelve un arreglo que lo contiene.

### Paso 4. Precio inválido: 400

```bash
curl -i -X POST http://localhost:3000/api/turnos \
  -H 'Content-Type: application/json' \
  --data '{"nombreCliente":"Ana Torres","nombreMascota":"Luna","tipoServicio":"Consulta veterinaria","fechaHora":"2026-12-01T10:00:00-05:00","precioBase":0,"prioritario":true}'
```

Se debe observar `400 Bad Request` y:

```json
{
  "mensaje": "Datos de entrada inválidos.",
  "errores": [
    "precioBase debe ser un número mayor que cero y menor o igual a 1000000000."
  ]
}
```

Explicar que el controlador rechaza la entrada antes de crear el turno. Si se consulta otra vez la lista, no habrá un registro nuevo por esta petición.

### Paso 5. ID inexistente: 404

```bash
curl -i http://localhost:3000/api/turnos/999
```

Se debe observar `404 Not Found` y:

```json
{
  "mensaje": "Turno no encontrado."
}
```

### Paso 6. Comprobar el caso sin prioridad

```bash
curl -i -X POST http://localhost:3000/api/turnos \
  -H 'Content-Type: application/json' \
  --data '{"nombreCliente":"Carlos Ruiz","nombreMascota":"Max","tipoServicio":"Vacunacion","fechaHora":"2026-12-01T11:00:00-05:00","precioBase":100000,"prioritario":false}'
```

El POST devuelve 201, `prioritario: false`, `porcentajeRecargo: 0`, `valorRecargo: 0` y `totalPagar: 100000`. Si se omite `prioritario`, se obtiene la misma regla de tarifa, con un nuevo identificador para cada creación.

### Paso 7. Pruebas automatizadas

Además del recorrido manual, se puede ejecutar:

```bash
npm test
```

Revisar los resultados de las pruebas. El archivo `docs/solicitudes.http` permite repetir las peticiones manuales desde un cliente HTTP compatible.

## 5. Reparto sugerido de la presentación

| Integrante | Parte sugerida |
| --- | --- |
| Johan Andres Arbelaez Medina | Contexto del servicio, orden del equipo y obtención de N. |
| Luis Eduardo Galindo Rodriguez | Inicio del servidor, archivo principal y rutas. |
| Santiago Parra Murillo | Controladores, validaciones y demostraciones de 400 y 404. |
| Santiago Zapata Mejia | Servicios, recargo y demostraciones de 200 y 201. |

Este reparto sirve para organizar la exposición. Todos deben poder responder preguntas sobre cualquier capa y ejecutar el recorrido completo.

## 6. Preguntas para practicar

| Pregunta | Idea que debe contener la respuesta |
| --- | --- |
| ¿Por qué N vale 1? | Arbelaez Medina es el primer apellido del equipo y su número oficial es 1. |
| ¿Dónde se calcula el recargo? | En `services/turnosService.js`; el porcentaje del equipo se obtiene a partir de N. |
| ¿Por qué el POST devuelve 201? | La petición crea un nuevo recurso; también se informa su ubicación mediante `Location`. |
| ¿En qué se diferencian 400 y 404? | 400 indica datos de entrada inválidos; 404 indica que el recurso consultado no se encontró. |
| ¿Qué pasa con `prioritario: "true"`? | Se rechaza con 400 porque es texto, no un booleano. |
| ¿Qué pasa al omitir `prioritario`? | Se utiliza `false` y el total es igual al precio base. |
| ¿Puede el cliente imponer `totalPagar`? | No; el controlador ignora ese campo y el servicio calcula el total. |
| ¿Qué ocurre al reiniciar el servidor? | Se pierde el arreglo de turnos y los identificadores comienzan nuevamente en 1. |
| ¿Por qué se usa `express.json()`? | Para convertir los cuerpos JSON en datos accesibles mediante `req.body`. |
| ¿Qué ocurre si el puerto 3000 está ocupado? | Se informa el problema; se puede ejecutar `PORT=3001 npm start` y ajustar la URL del cliente. |

## 7. Comprobación de la entrega

- [ ] Ejecutar `npm install`, `npm test` y la demostración en el computador que se utilizará.
- [ ] Confirmar que todos explican las responsabilidades de rutas, controladores y servicios.
- [ ] Comprobar que el repositorio de GitHub sea público y contenga el código completo, `package.json` y README.
- [ ] Confirmar que `node_modules` no se haya incluido en Git.
- [ ] Preparar el enlace público del repositorio para la única entrega del equipo en la plataforma institucional.
- [ ] Realizar la entrega en el plazo indicado por el docente.
- [ ] Presentar la sustentación cuando el docente indique el orden.

La existencia de esta guía no significa que la entrega institucional o la exposición ya se hayan realizado.
