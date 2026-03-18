// Calculadora de Flete - El Forastero S.A.

const state = {
    zona: null,
    lista: null,
    pedido: [], // { producto, um: 'unidad'|'pack', cantidad }
};

// Formateo de moneda ARS
function formatMoney(n) {
    return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatKg(n) {
    return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
}

// --- INIT ---
function init() {
    const zonaSelect = document.getElementById('zona');
    const listaSelect = document.getElementById('lista');
    const buscarInput = document.getElementById('buscar');
    const filtroRubro = document.getElementById('filtro-rubro');

    // Poblar zonas
    Object.keys(TARIFAS).forEach(zona => {
        const opt = document.createElement('option');
        opt.value = zona;
        opt.textContent = zona;
        zonaSelect.appendChild(opt);
    });

    // Poblar rubros
    RUBROS.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        filtroRubro.appendChild(opt);
    });

    // Eventos
    zonaSelect.addEventListener('change', onZonaChange);
    listaSelect.addEventListener('change', onListaChange);
    buscarInput.addEventListener('input', onBuscar);
    buscarInput.addEventListener('focus', onBuscar);
    filtroRubro.addEventListener('change', onBuscar);

    // Cerrar resultados al hacer click fuera
    document.addEventListener('click', (e) => {
        const resultados = document.getElementById('resultados');
        const searchSection = document.querySelector('.search-section');
        if (!searchSection.contains(e.target)) {
            resultados.classList.add('hidden');
        }
    });
}

function onZonaChange() {
    const zona = document.getElementById('zona').value;
    const listaSelect = document.getElementById('lista');
    const buscarInput = document.getElementById('buscar');
    const filtroRubro = document.getElementById('filtro-rubro');

    state.zona = zona || null;
    state.lista = null;

    // Limpiar y poblar listas
    listaSelect.innerHTML = '<option value="">Seleccionar lista...</option>';

    if (zona && TARIFAS[zona]) {
        Object.keys(TARIFAS[zona].listas).forEach(l => {
            const opt = document.createElement('option');
            opt.value = l;
            opt.textContent = 'Lista ' + l;
            listaSelect.appendChild(opt);
        });
        listaSelect.disabled = false;
    } else {
        listaSelect.disabled = true;
    }

    buscarInput.disabled = true;
    filtroRubro.disabled = true;
    updateTarifaInfo();
    recalcular();
}

function onListaChange() {
    const lista = document.getElementById('lista').value;
    const buscarInput = document.getElementById('buscar');
    const filtroRubro = document.getElementById('filtro-rubro');

    state.lista = lista || null;

    if (lista) {
        buscarInput.disabled = false;
        filtroRubro.disabled = false;
        buscarInput.focus();
    } else {
        buscarInput.disabled = true;
        filtroRubro.disabled = true;
    }

    updateTarifaInfo();
    recalcular();
}

function updateTarifaInfo() {
    const el = document.getElementById('tarifa-info');
    if (!state.zona || !state.lista) {
        el.classList.add('hidden');
        return;
    }

    const tarifa = TARIFAS[state.zona];
    const valor = tarifa.listas[state.lista];

    if (tarifa.tipo === 'peso') {
        const conIva = valor * 1.21;
        el.innerHTML = `<strong>${state.zona} - Lista ${state.lista}:</strong> ${formatMoney(valor)}/kg + IVA = <strong>${formatMoney(conIva)}/kg</strong>`;
    } else {
        el.innerHTML = `<strong>${state.zona} - Lista ${state.lista}:</strong> ${(valor * 100).toFixed(0)}% sobre el total del pedido`;
    }
    el.classList.remove('hidden');
}

// --- BUSQUEDA ---
function onBuscar() {
    const query = document.getElementById('buscar').value.trim().toLowerCase();
    const rubro = document.getElementById('filtro-rubro').value;
    const resultados = document.getElementById('resultados');

    if (!query && !rubro) {
        resultados.classList.add('hidden');
        return;
    }

    let filtered = PRODUCTOS;

    if (rubro) {
        filtered = filtered.filter(p => p.rubro === rubro);
    }

    if (query) {
        const terms = query.split(/\s+/);
        filtered = filtered.filter(p => {
            const text = (p.descripcion + ' ' + p.codigo + ' ' + p.rubro).toLowerCase();
            return terms.every(t => text.includes(t));
        });
    }

    // Limitar a 50 resultados
    filtered = filtered.slice(0, 50);

    if (filtered.length === 0) {
        resultados.innerHTML = '<div class="resultado-item"><span class="resultado-nombre">Sin resultados</span></div>';
        resultados.classList.remove('hidden');
        return;
    }

    resultados.innerHTML = filtered.map(p =>
        `<div class="resultado-item" data-codigo="${p.codigo}">
            <div>
                <div class="resultado-nombre">${highlightMatch(p.descripcion, query)}</div>
                <div class="resultado-rubro">${p.rubro}</div>
            </div>
            <div class="resultado-precio">${formatMoney(p.precio_unit_iva)}</div>
        </div>`
    ).join('');

    resultados.querySelectorAll('.resultado-item').forEach(el => {
        el.addEventListener('click', () => {
            const cod = el.dataset.codigo;
            const prod = PRODUCTOS.find(p => p.codigo === cod);
            if (prod) openModal(prod);
        });
    });

    resultados.classList.remove('hidden');
}

function highlightMatch(text, query) {
    if (!query) return text;
    const terms = query.split(/\s+/);
    let result = text;
    terms.forEach(term => {
        if (term) {
            const regex = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
            result = result.replace(regex, '<strong>$1</strong>');
        }
    });
    return result;
}

// --- MODAL ---
function openModal(producto) {
    document.getElementById('resultados').classList.add('hidden');
    document.getElementById('buscar').value = '';

    const hasPack = producto.pack_qty > 1;
    let um = hasPack ? 'pack' : 'unidad';
    let cantidad = 1;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    function render() {
        const precio = um === 'pack' ? producto.precio_pred_iva : producto.precio_unit_iva;
        const umLabel = um === 'pack' ? producto.um_pred : 'Unidad';
        const pesoLinea = um === 'pack'
            ? producto.peso_unit_kg * producto.pack_qty * cantidad
            : producto.peso_unit_kg * cantidad;

        overlay.innerHTML = `
            <div class="modal">
                <h3>${producto.descripcion}</h3>
                <div class="modal-rubro">${producto.rubro} | Cod: ${producto.codigo}</div>
                ${hasPack ? `
                <div class="um-toggle">
                    <button class="${um === 'unidad' ? 'active' : ''}" data-um="unidad">Unidad</button>
                    <button class="${um === 'pack' ? 'active' : ''}" data-um="pack">${producto.um_pred}</button>
                </div>` : ''}
                <div class="precio-display">
                    ${umLabel}: <strong>${formatMoney(precio)}</strong>
                    <br><small>Peso: ${formatKg(pesoLinea)} | Total: ${formatMoney(precio * cantidad)}</small>
                </div>
                <div class="cant-row">
                    <button class="btn-menos">&minus;</button>
                    <input type="number" class="cant-input" value="${cantidad}" min="1">
                    <button class="btn-mas">&plus;</button>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary btn-cancelar">Cancelar</button>
                    <button class="btn btn-primary btn-agregar">Agregar</button>
                </div>
            </div>
        `;

        // Eventos del modal
        overlay.querySelector('.btn-cancelar')?.addEventListener('click', () => overlay.remove());
        overlay.querySelector('.btn-agregar')?.addEventListener('click', () => {
            agregarAlPedido(producto, um, cantidad);
            overlay.remove();
        });
        overlay.querySelector('.btn-menos')?.addEventListener('click', () => {
            if (cantidad > 1) { cantidad--; render(); }
        });
        overlay.querySelector('.btn-mas')?.addEventListener('click', () => {
            cantidad++;
            render();
        });
        const cantInput = overlay.querySelector('.cant-input');
        cantInput?.addEventListener('change', () => {
            const v = parseInt(cantInput.value);
            if (v > 0) { cantidad = v; render(); }
        });
        overlay.querySelectorAll('.um-toggle button').forEach(btn => {
            btn.addEventListener('click', () => {
                um = btn.dataset.um;
                render();
            });
        });

        // Click en overlay cierra
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    render();
    document.body.appendChild(overlay);

    // Focus en cantidad
    setTimeout(() => {
        const inp = overlay.querySelector('.cant-input');
        if (inp) inp.select();
    }, 100);
}

// --- PEDIDO ---
function agregarAlPedido(producto, um, cantidad) {
    // Si ya existe el mismo producto con la misma UM, sumar cantidad
    const existing = state.pedido.find(
        item => item.producto.codigo === producto.codigo && item.um === um
    );

    if (existing) {
        existing.cantidad += cantidad;
    } else {
        state.pedido.push({ producto, um, cantidad });
    }

    renderPedido();
    recalcular();
}

function eliminarDelPedido(index) {
    state.pedido.splice(index, 1);
    renderPedido();
    recalcular();
}

function renderPedido() {
    const vacio = document.getElementById('pedido-vacio');
    const tablaWrap = document.getElementById('pedido-tabla-wrap');
    const tbody = document.getElementById('pedido-body');

    if (state.pedido.length === 0) {
        vacio.classList.remove('hidden');
        tablaWrap.classList.add('hidden');
        return;
    }

    vacio.classList.add('hidden');
    tablaWrap.classList.remove('hidden');

    tbody.innerHTML = state.pedido.map((item, i) => {
        const p = item.producto;
        const precio = item.um === 'pack' ? p.precio_pred_iva : p.precio_unit_iva;
        const pesoLinea = item.um === 'pack'
            ? p.peso_unit_kg * p.pack_qty * item.cantidad
            : p.peso_unit_kg * item.cantidad;
        const subtotal = precio * item.cantidad;
        const umLabel = item.um === 'pack' ? p.um_pred : 'Unid.';

        return `<tr>
            <td class="col-producto"><span class="prod-nombre">${p.descripcion}</span></td>
            <td>${umLabel}</td>
            <td>${item.cantidad}</td>
            <td>${formatKg(pesoLinea)}</td>
            <td>${formatMoney(subtotal)}</td>
            <td><button class="btn-eliminar" data-index="${i}" title="Eliminar">&times;</button></td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', () => {
            eliminarDelPedido(parseInt(btn.dataset.index));
        });
    });
}

function recalcular() {
    const resumen = document.getElementById('resumen');

    if (state.pedido.length === 0 || !state.zona || !state.lista) {
        resumen.classList.add('hidden');
        return;
    }

    resumen.classList.remove('hidden');

    let subtotal = 0;
    let pesoTotal = 0;

    state.pedido.forEach(item => {
        const p = item.producto;
        const precio = item.um === 'pack' ? p.precio_pred_iva : p.precio_unit_iva;
        const peso = item.um === 'pack'
            ? p.peso_unit_kg * p.pack_qty * item.cantidad
            : p.peso_unit_kg * item.cantidad;

        subtotal += precio * item.cantidad;
        pesoTotal += peso;
    });

    const tarifa = TARIFAS[state.zona];
    const valor = tarifa.listas[state.lista];
    let flete = 0;

    if (tarifa.tipo === 'peso') {
        flete = pesoTotal * valor * 1.21;
    } else {
        flete = subtotal * valor;
    }

    const total = subtotal + flete;

    document.getElementById('res-subtotal').textContent = formatMoney(subtotal);
    document.getElementById('res-peso').textContent = formatKg(pesoTotal);
    document.getElementById('res-flete').textContent = formatMoney(flete);
    document.getElementById('res-total').textContent = formatMoney(total);
}

// --- START ---
document.addEventListener('DOMContentLoaded', init);
