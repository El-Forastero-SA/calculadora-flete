// Calculadora de Flete - El Forastero S.A.

const state = {
    lista: null,      // key de TARIFAS (ej: "Bari A")
    localidad: null,  // nombre de la localidad seleccionada
    pedido: [],
};

const RUBRO_GROUPS = {
    'Mascotas - Perros': r => r.startsWith('PERROS'),
    'Mascotas - Gatos': r => r.startsWith('GATOS'),
    'Mascotas - Otros': r => ['ABSORBENTES SANITARIOS', 'COCOONING ABSORBENTES', 'EQUINOS - FORTALEZA', 'PURINA BONELO GATOS', 'PURINA BONZO', 'PURINA CAT CHOW', 'PURINA DOGUI', 'PURINA EXCELLENT GATOS', 'PURINA EXCELLENT PERROS', 'PURINA FELIX MEGAMIX', 'PURINA GATI', 'PURINA PIEDRAS SANITARIAS', 'PURINA PRO PLAN GATOS', 'PURINA PRO PLAN PERROS', 'PURINA PRO PLAN VETERINARY GATOS', 'PURINA WET PRO PLAN PERROS'].includes(r),
    'Alimentos': r => ['CABRALES CAFE', 'CABRALES CAPSULAS', 'CABRALES EDULCORANTES', 'CABRALES FILTROS', 'CABRALES PASTAS BARILLA', 'CABRALES TE Y MATE COCIDO', 'DON BERNABEU PASTAS', 'EDULCORANTES', 'HEALTHYVEG LEGUMBRES', 'LA MOROCHA LEGUMBRES', 'LA MOROCHA PASTAS', 'MARUCHAN', 'MERLIN FOODS', 'MOLINOS ACEITES ESPECIALES', 'MOLINOS ACEITES TRADICIONALES', 'MOLINOS ARROZ', 'MOLINOS GELIFICABLES', 'MOLINOS HARINAS', 'MOLINOS HORNEABLES', 'MOLINOS MINERVA', 'MOLINOS PASTAS DON FELIPE', 'MOLINOS PASTAS DON VICENTE', 'MOLINOS PASTAS FAVORITA', 'MOLINOS PASTAS LUCCHETTI', 'MOLINOS PASTAS MATARAZZO', 'MOLINOS PASTAS RELLENAS LUCCHETTI', 'MOLINOS PASTAS TERRABUSI', 'MOLINOS PREMEZCLAS', 'MOLINOS REBOZADORES', 'MOLINOS SEMOLA', 'MOLINOS SOLUBLES', 'MOLINOS TE Y MATE COCIDO', 'MUSTAD', 'PASTASOLE PASTAS', 'DR SCHAR'].includes(r),
    'Bebidas': r => r.startsWith('MH ') || r.startsWith('BLEST') || r.startsWith('FINCA') || r.startsWith('STRAUS') || r === 'GRANGER',
    'Yerbas y Mates': r => ['CAMPECHE YERBAS', 'MOLINOS YERBAS', 'ROSAMONTE ACCESORIOS', 'ROSAMONTE TE Y MATE COCIDO', 'ROSAMONTE YERBAS', 'VERDEFLOR YERBA', 'MOLINOS NIETO SENETINER', 'MOLINOS NIETO SENETINER ESPUMANTES'].includes(r),
    'Papelera e Higiene': r => r.startsWith('PAPELERA'),
};

function getRubroGroup(rubro) {
    for (const [group, test] of Object.entries(RUBRO_GROUPS)) {
        if (test(rubro)) return group;
    }
    return 'Otros';
}

function formatMoney(n) {
    return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatKg(n) {
    return n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg';
}

function init() {
    const localidadInput = document.getElementById('localidad-input');
    const buscarInput = document.getElementById('buscar');
    const filtroRubro = document.getElementById('filtro-rubro');

    // Construir filtro de rubros agrupado
    const groupedRubros = {};
    RUBROS.forEach(r => {
        const group = getRubroGroup(r);
        if (!groupedRubros[group]) groupedRubros[group] = [];
        groupedRubros[group].push(r);
    });

    const groupOrder = ['Mascotas - Perros', 'Mascotas - Gatos', 'Mascotas - Otros', 'Alimentos', 'Bebidas', 'Yerbas y Mates', 'Papelera e Higiene', 'Otros'];
    groupOrder.forEach(group => {
        if (!groupedRubros[group] || groupedRubros[group].length === 0) return;
        const optgroup = document.createElement('optgroup');
        optgroup.label = group;
        groupedRubros[group].forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            optgroup.appendChild(opt);
        });
        filtroRubro.appendChild(optgroup);
    });

    localidadInput.addEventListener('input', onLocalidadInput);
    localidadInput.addEventListener('focus', onLocalidadInput);
    buscarInput.addEventListener('input', onBuscar);
    buscarInput.addEventListener('focus', onBuscar);
    filtroRubro.addEventListener('change', onBuscar);

    document.addEventListener('click', (e) => {
        const resultados = document.getElementById('resultados');
        const localidadResultados = document.getElementById('localidad-resultados');
        const searchSection = document.querySelector('.search-section');
        const configSection = document.querySelector('.config-section');

        if (!searchSection.contains(e.target)) resultados.classList.add('hidden');
        if (!configSection.contains(e.target)) localidadResultados.classList.add('hidden');
    });
}

function normalize(str) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function onLocalidadInput() {
    const query = normalize(document.getElementById('localidad-input').value.trim());
    const resultados = document.getElementById('localidad-resultados');

    // Si el usuario borró el campo, resetear estado
    if (!query) {
        resultados.classList.add('hidden');
        if (state.lista) {
            state.lista = null;
            state.localidad = null;
            document.getElementById('buscar').disabled = true;
            document.getElementById('filtro-rubro').disabled = true;
            updateTarifaInfo();
            recalcular();
        }
        return;
    }

    const terms = query.split(/\s+/);
    const filtered = LOCALIDADES.filter(loc => {
        const text = normalize(loc.nombre + ' ' + loc.provincia + ' ' + loc.cp);
        return terms.every(t => text.includes(t));
    }).slice(0, 20);

    if (filtered.length === 0) {
        resultados.innerHTML = '<div class="resultado-item"><span class="resultado-nombre" style="color: var(--gris-texto);">Sin resultados para "' + query + '"</span></div>';
        resultados.classList.remove('hidden');
        return;
    }

    resultados.innerHTML = filtered.map(loc =>
        '<div class="resultado-item localidad-item" data-lista="' + loc.lista + '" data-nombre="' + loc.nombre + '">' +
            '<div>' +
                '<div class="resultado-nombre">' + highlightMatch(loc.nombre, query) + '</div>' +
                '<div class="resultado-rubro">' + loc.provincia + ' &middot; CP ' + loc.cp + '</div>' +
            '</div>' +
            '<div class="localidad-lista-badge">' + loc.lista + '</div>' +
        '</div>'
    ).join('');

    resultados.querySelectorAll('.localidad-item').forEach(el => {
        el.addEventListener('click', () => {
            selectLocalidad(el.dataset.lista, el.dataset.nombre);
        });
    });

    resultados.classList.remove('hidden');
}

function selectLocalidad(lista, nombre) {
    state.lista = lista;
    state.localidad = nombre;

    document.getElementById('localidad-input').value = nombre;
    document.getElementById('localidad-resultados').classList.add('hidden');

    const buscarInput = document.getElementById('buscar');
    const filtroRubro = document.getElementById('filtro-rubro');
    buscarInput.disabled = false;
    filtroRubro.disabled = false;

    updateTarifaInfo();
    recalcular();
}

function updateTarifaInfo() {
    const el = document.getElementById('tarifa-info');
    if (!state.lista || !TARIFAS[state.lista]) {
        el.classList.add('hidden');
        return;
    }

    const tarifa = TARIFAS[state.lista];

    if (tarifa.tipo === 'peso') {
        const conIva = tarifa.valor * 1.21;
        el.innerHTML = '<strong>' + state.localidad + '</strong> &middot; Lista ' + state.lista + ': ' + formatMoney(tarifa.valor) + '/kg + IVA = <strong>' + formatMoney(conIva) + '/kg</strong>';
    } else {
        el.innerHTML = '<strong>' + state.localidad + '</strong> &middot; Lista ' + state.lista + ': <strong>' + (tarifa.valor * 100).toFixed(0) + '%</strong> sobre el total del pedido';
    }
    el.classList.remove('hidden');
}

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

    filtered = filtered.slice(0, 50);

    if (filtered.length === 0) {
        resultados.innerHTML = '<div class="resultado-item"><span class="resultado-nombre" style="color: var(--gris-texto);">Sin resultados</span></div>';
        resultados.classList.remove('hidden');
        return;
    }

    resultados.innerHTML = filtered.map(p =>
        '<div class="resultado-item" data-codigo="' + p.codigo + '">' +
            '<div>' +
                '<div class="resultado-nombre">' + highlightMatch(p.descripcion, query) + '</div>' +
                '<div class="resultado-rubro">' + p.rubro + '</div>' +
            '</div>' +
            '<div class="resultado-precio">' + formatMoney(p.precio_unit_iva) + '</div>' +
        '</div>'
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

        overlay.innerHTML =
            '<div class="modal">' +
                '<h3>' + producto.descripcion + '</h3>' +
                '<div class="modal-rubro">' + producto.rubro + ' &middot; Cod: ' + producto.codigo + '</div>' +
                (hasPack ?
                '<div class="um-toggle">' +
                    '<button class="' + (um === 'unidad' ? 'active' : '') + '" data-um="unidad">Unidad</button>' +
                    '<button class="' + (um === 'pack' ? 'active' : '') + '" data-um="pack">' + producto.um_pred + '</button>' +
                '</div>' : '') +
                '<div class="precio-display">' +
                    '<div class="precio-label">' + umLabel + '</div>' +
                    '<strong>' + formatMoney(precio) + '</strong>' +
                    '<small>Peso: ' + formatKg(pesoLinea) + ' &middot; Total: ' + formatMoney(precio * cantidad) + '</small>' +
                '</div>' +
                '<div class="cant-row">' +
                    '<button class="btn-menos">&minus;</button>' +
                    '<input type="number" class="cant-input" value="' + cantidad + '" min="1">' +
                    '<button class="btn-mas">&plus;</button>' +
                '</div>' +
                '<div class="modal-actions">' +
                    '<button class="btn btn-secondary btn-cancelar">Cancelar</button>' +
                    '<button class="btn btn-primary btn-agregar">Agregar al pedido</button>' +
                '</div>' +
            '</div>';

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

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    render();
    document.body.appendChild(overlay);

    setTimeout(() => {
        const inp = overlay.querySelector('.cant-input');
        if (inp) inp.select();
    }, 100);
}

function agregarAlPedido(producto, um, cantidad) {
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

        return '<tr>' +
            '<td class="col-producto"><span class="prod-nombre">' + p.descripcion + '</span></td>' +
            '<td>' + umLabel + '</td>' +
            '<td class="col-num">' + item.cantidad + '</td>' +
            '<td class="col-num">' + formatKg(pesoLinea) + '</td>' +
            '<td class="col-num">' + formatMoney(subtotal) + '</td>' +
            '<td><button class="btn-eliminar" data-index="' + i + '" title="Eliminar">&times;</button></td>' +
        '</tr>';
    }).join('');

    tbody.querySelectorAll('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', () => {
            eliminarDelPedido(parseInt(btn.dataset.index));
        });
    });
}

function recalcular() {
    const resumen = document.getElementById('resumen');

    if (state.pedido.length === 0 || !state.lista) {
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

    const tarifa = TARIFAS[state.lista];
    let flete = 0;

    if (tarifa.tipo === 'peso') {
        flete = pesoTotal * tarifa.valor * 1.21;
    } else {
        flete = subtotal * tarifa.valor;
    }

    const total = subtotal + flete;

    document.getElementById('res-subtotal').textContent = formatMoney(subtotal);
    document.getElementById('res-peso').textContent = formatKg(pesoTotal);
    document.getElementById('res-flete').textContent = formatMoney(flete);
    document.getElementById('res-total').textContent = formatMoney(total);
}

document.addEventListener('DOMContentLoaded', init);
