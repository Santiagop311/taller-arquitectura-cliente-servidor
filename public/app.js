(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const form = $('turno-form');
  const precio = $('precioBase');
  const prioridad = $('prioritario');
  const guardar = $('guardar-turno');
  const actualizar = $('actualizar-turnos');
  const vacioOriginal = $('lista-turnos').querySelector('.empty-state').cloneNode(true);
  const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 2, minimumFractionDigits: 0,
  });
  const fechaLegible = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric',
  });
  const horaLegible = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit',
  });
  let turnos = [];
  let filtro = 'todos';
  let guardando = false;
  let temporizador;
  let consultaCotizacion;
  let versionAgenda = 0;
  let versionDetalle = 0;

  function nodo(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);
    if (clase) elemento.className = clase;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
  }

  function fechaDeHoy() {
    const partes = new Intl.DateTimeFormat('en', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
    return `${valor('year')}-${valor('month')}-${valor('day')}`;
  }

  function prepararFecha() {
    $('fecha').value = fechaDeHoy();
    $('fecha-actual').textContent = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long',
    }).format(new Date());
  }

  async function solicitar(url, opciones = {}) {
    const respuesta = await fetch(url, opciones);
    const contenido = await respuesta.json();
    if (!respuesta.ok) {
      const error = new Error(contenido.mensaje || 'No se pudo completar la solicitud.');
      error.estado = respuesta.status;
      error.detalles = contenido.errores;
      throw error;
    }
    return contenido;
  }

  const opcionesPost = (datos) => ({
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
  });

  function mensajeFormulario(texto, tipo) {
    const aviso = $('form-feedback');
    aviso.textContent = texto;
    aviso.className = `form-feedback feedback-${tipo}`;
    aviso.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    aviso.hidden = false;
  }

  function limpiarCotizacion() {
    clearTimeout(temporizador);
    consultaCotizacion?.abort();
    for (const id of ['resumen-base', 'resumen-recargo', 'resumen-total']) $(id).textContent = '—';
    $('recargo-label').textContent = 'Recargo por prioridad';
    $('quote-status').textContent = 'Completa el precio para consultar el total.';
  }

  function programarCotizacion() {
    limpiarCotizacion();
    if (precio.value === '' || !precio.validity.valid || precio.valueAsNumber <= 0) return;
    $('quote-status').textContent = 'Consultando el total…';
    temporizador = setTimeout(cotizar, 250);
  }

  async function cotizar() {
    const controlador = new AbortController();
    consultaCotizacion = controlador;
    try {
      const tarifa = await solicitar('/api/turnos/cotizacion', {
        ...opcionesPost({ precioBase: precio.valueAsNumber, prioritario: prioridad.checked }),
        signal: controlador.signal,
      });
      if (controlador.signal.aborted) return;
      $('resumen-base').textContent = moneda.format(tarifa.precioBase);
      $('resumen-recargo').textContent = moneda.format(tarifa.valorRecargo);
      $('resumen-total').textContent = moneda.format(tarifa.totalPagar);
      $('recargo-label').textContent = tarifa.prioritario
        ? `Recargo por prioridad (${tarifa.porcentajeRecargo} %)` : 'Sin recargo';
      $('quote-status').textContent = 'Total confirmado. El turno se crea al pulsar Registrar turno.';
    } catch (error) {
      if (error.name === 'AbortError') return;
      $('quote-status').textContent = error.estado === 400
        ? 'Revisa el precio: debe ser positivo y tener como máximo dos decimales.'
        : 'No se pudo consultar el total. Comprueba que el servidor esté encendido.';
    }
  }

  function normalizar(texto) {
    return String(texto).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  }

  function tarjeta(turno) {
    const card = nodo('article', 'turno-card');
    const top = nodo('div', 'turno-top');
    const avatar = nodo('div', 'turno-avatar', turno.nombreMascota.slice(0, 1).toUpperCase());
    avatar.setAttribute('aria-hidden', 'true');
    const info = nodo('div', 'turno-info');
    info.append(nodo('h3', '', turno.nombreMascota), nodo('p', '', turno.nombreCliente));
    top.append(avatar, info, nodo('span', `badge badge-${turno.prioritario ? 'prioritario' : 'normal'}`,
      turno.prioritario ? 'Prioritario' : 'Normal'));
    const meta = nodo('div', 'turno-meta');
    meta.append(nodo('span', '', turno.tipoServicio),
      nodo('span', 'turno-date', `${fechaLegible.format(new Date(turno.fechaHora))} · ${horaLegible.format(new Date(turno.fechaHora))}`));
    const footer = nodo('div', 'turno-footer');
    const total = nodo('div', 'turno-total');
    total.append(nodo('span', '', 'Total a pagar'), nodo('strong', '', moneda.format(turno.totalPagar)));
    const ver = nodo('button', 'ver-detalle', 'Ver detalle');
    ver.type = 'button';
    ver.dataset.turnoId = String(turno.id);
    ver.setAttribute('aria-label', `Ver detalle de ${turno.nombreMascota}, turno ${turno.id}`);
    footer.append(total, ver);
    card.append(top, meta, footer);
    return card;
  }

  function estadoVacio(busquedaActiva) {
    const vacio = vacioOriginal.cloneNode(true);
    if (busquedaActiva) {
      vacio.querySelector('.empty-title').textContent = 'No encontramos coincidencias';
      vacio.querySelector('.empty-copy').textContent = 'Prueba otro nombre o selecciona Todos para ver la agenda completa.';
      const pie = vacio.querySelector('.empty-caption');
      if (pie) pie.hidden = true;
    }
    return vacio;
  }

  function renderizar() {
    $('stat-total').textContent = String(turnos.length);
    $('stat-prioritarios').textContent = String(turnos.filter((turno) => turno.prioritario).length);
    $('stat-ingresos').textContent = moneda.format(turnos.reduce((total, turno) => total + turno.totalPagar, 0));
    const consulta = normalizar($('buscar-turnos').value.trim());
    const visibles = turnos.filter((turno) => {
      const cumpleFiltro = filtro === 'todos' || (filtro === 'prioritarios' ? turno.prioritario : !turno.prioritario);
      return cumpleFiltro && normalizar(`${turno.id} ${turno.nombreCliente} ${turno.nombreMascota} ${turno.tipoServicio}`).includes(consulta);
    }).sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora) || a.id - b.id);
    const lista = $('lista-turnos');
    lista.replaceChildren(...(visibles.length ? visibles.map(tarjeta) : [estadoVacio(Boolean(consulta) || filtro !== 'todos')]));
    $('agenda-estado').textContent = `${visibles.length} ${visibles.length === 1 ? 'turno' : 'turnos'} en la agenda`;
    $('agenda-estado').classList.remove('text-error');
  }

  async function cargarTurnos() {
    const version = ++versionAgenda;
    actualizar.disabled = true;
    $('agenda-estado').textContent = 'Actualizando agenda…';
    try {
      const resultado = await solicitar('/api/turnos');
      if (version !== versionAgenda) return;
      turnos = resultado;
      renderizar();
    } catch {
      if (version !== versionAgenda) return;
      $('agenda-estado').textContent = 'No se pudo actualizar la agenda. Comprueba la conexión y pulsa Actualizar.';
      $('agenda-estado').classList.add('text-error');
    } finally {
      if (version === versionAgenda) actualizar.disabled = false;
    }
  }

  function filaDetalle(etiqueta, valor, clase = '') {
    const fila = nodo('div', `detalle-row ${clase}`.trim());
    fila.append(nodo('dt', '', etiqueta), nodo('dd', '', valor));
    return fila;
  }

  async function mostrarDetalle(id) {
    const version = ++versionDetalle;
    const contenido = $('detalle-contenido');
    contenido.replaceChildren(nodo('p', '', 'Consultando turno…'));
    $('detalle-dialog').showModal();
    try {
      const turno = await solicitar(`/api/turnos/${id}`);
      if (version !== versionDetalle) return;
      const detalle = nodo('dl', 'detalle-grid');
      detalle.append(
        filaDetalle('Número de turno', `#${turno.id}`),
        filaDetalle('Mascota', turno.nombreMascota), filaDetalle('Cliente', turno.nombreCliente),
        filaDetalle('Servicio', turno.tipoServicio),
        filaDetalle('Fecha de atención', `${fechaLegible.format(new Date(turno.fechaHora))} · ${horaLegible.format(new Date(turno.fechaHora))}`),
        filaDetalle('Atención', turno.prioritario ? 'Prioritaria' : 'Normal'),
        filaDetalle('Precio base', moneda.format(turno.precioBase)),
        filaDetalle(`Recargo (${turno.porcentajeRecargo} %)`, moneda.format(turno.valorRecargo)),
        filaDetalle('Total a pagar', moneda.format(turno.totalPagar), 'detalle-total'),
      );
      contenido.replaceChildren(detalle);
    } catch (error) {
      if (version !== versionDetalle) return;
      contenido.replaceChildren(nodo('p', 'text-error', error.estado === 404
        ? 'Este turno ya no está disponible. Cierra el detalle y actualiza la agenda.'
        : 'No se pudo consultar el turno. Cierra el detalle e inténtalo de nuevo.'));
    }
  }

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (guardando) return;
    for (const id of ['nombreCliente', 'nombreMascota']) {
      $(id).setCustomValidity($(id).value.trim() ? '' : 'Escribe un nombre válido.');
    }
    if (!form.reportValidity()) return;
    guardando = true;
    guardar.disabled = true;
    $('guardar-label').textContent = 'Registrando…';
    $('limpiar-form').disabled = true;
    $('form-feedback').hidden = true;
    const datos = {
      nombreCliente: $('nombreCliente').value.trim(), nombreMascota: $('nombreMascota').value.trim(),
      tipoServicio: $('tipoServicio').value,
      fechaHora: `${$('fecha').value}T${$('hora').value}:00-05:00`,
      precioBase: precio.valueAsNumber, prioritario: prioridad.checked,
    };
    try {
      const creado = await solicitar('/api/turnos', opcionesPost(datos));
      // La respuesta del servidor es la fuente del precio y del identificador.
      turnos = [...turnos.filter((turno) => turno.id !== creado.id), creado];
      renderizar();
      form.reset();
      prepararFecha();
      limpiarCotizacion();
      mensajeFormulario(`Turno #${creado.id} registrado para ${creado.nombreMascota}. Total a pagar: ${moneda.format(creado.totalPagar)}.`, 'success');
      await cargarTurnos();
    } catch (error) {
      const texto = error.estado === 400
        ? 'Revisa los datos del formulario: todos los nombres son obligatorios, la fecha debe ser válida y el precio debe ser positivo con hasta dos decimales.'
        : 'No pudimos confirmar el registro. Actualiza la agenda antes de volver a intentarlo.';
      mensajeFormulario(texto, 'error');
    } finally {
      guardando = false;
      guardar.disabled = false;
      $('guardar-label').textContent = 'Registrar turno';
      $('limpiar-form').disabled = false;
    }
  });

  $('limpiar-form').addEventListener('click', () => {
    form.reset();
    for (const id of ['nombreCliente', 'nombreMascota']) $(id).setCustomValidity('');
    prepararFecha();
    limpiarCotizacion();
    $('form-feedback').hidden = true;
    $('nombreCliente').focus();
  });
  for (const id of ['nombreCliente', 'nombreMascota']) $(id).addEventListener('input', () => $(id).setCustomValidity(''));
  precio.addEventListener('input', programarCotizacion);
  prioridad.addEventListener('change', programarCotizacion);
  actualizar.addEventListener('click', cargarTurnos);
  $('buscar-turnos').addEventListener('input', renderizar);
  document.querySelectorAll('[data-filter]').forEach((boton) => {
    boton.addEventListener('click', () => {
      filtro = boton.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((otro) => {
        otro.classList.toggle('is-active', otro === boton);
        otro.setAttribute('aria-pressed', String(otro === boton));
      });
      renderizar();
    });
  });
  $('lista-turnos').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-turno-id]');
    if (boton) mostrarDetalle(boton.dataset.turnoId);
  });
  $('cerrar-detalle').addEventListener('click', () => $('detalle-dialog').close());
  $('detalle-dialog').addEventListener('close', () => { versionDetalle += 1; });
  $('detalle-dialog').addEventListener('click', (evento) => {
    if (evento.target === $('detalle-dialog')) {
      const rect = $('detalle-dialog').getBoundingClientRect();
      if (evento.clientX < rect.left || evento.clientX > rect.right || evento.clientY < rect.top || evento.clientY > rect.bottom) $('detalle-dialog').close();
    }
  });

  prepararFecha();
  renderizar();
  cargarTurnos();
})();
