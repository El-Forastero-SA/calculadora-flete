"""
Genera data.js para la calculadora de flete de El Forastero.
Cruza Maestro_Estandarizado.xlsx + Lista_Precios_Estandarizada.xlsx
"""

import openpyxl
import json
import re
import os

# Rutas a los archivos fuente
BASE = "/Users/francoavacaperetti/Library/Application Support/Claude/local-agent-mode-sessions/90c57181-1e5e-4076-a655-9f37bc7fb1c0/ad610f33-4a84-4aaf-af17-a3d67859b83b/local_ab379a7d-7cb6-400d-b2ef-e5ad8143956e/outputs"
MAESTRO = os.path.join(BASE, "Maestro_Estandarizado.xlsx")
LISTA = os.path.join(BASE, "Lista_Precios_Estandarizada.xlsx")
OUTPUT = os.path.join(os.path.dirname(__file__), "data.js")


def parse_decimal(val):
    """Convierte string con coma decimal a float.
    Soporta: float/int nativo, '7.5' (punto decimal), '7,5' (coma decimal),
    '1.234,56' (miles con punto, decimal con coma).
    """
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if not s:
        return 0.0
    # Si tiene coma: formato ARS (ej: "1.234,56" o "7,5")
    if ',' in s:
        s = s.replace(".", "").replace(",", ".")
    # Si solo tiene punto: es separador decimal directo (ej: "7.5")
    # → no tocar, parsear directo
    try:
        return float(s)
    except ValueError:
        return 0.0


def extract_pack_qty(um_pred):
    """Extrae cantidad de unidades del UM Pred (ej: PACKx10 -> 10, BOLx5 -> 5)."""
    if not um_pred:
        return 1
    m = re.search(r'x(\d+)', str(um_pred), re.IGNORECASE)
    return int(m.group(1)) if m else 1


def clean_rubro(rubro):
    """Quita el código entre paréntesis del rubro."""
    if not rubro:
        return ""
    return re.sub(r'\s*\(\d+\)\s*$', '', str(rubro)).strip()


def main():
    # Leer Maestro: codigo -> peso_kg
    wb_m = openpyxl.load_workbook(MAESTRO)
    ws_m = wb_m.active
    maestro = {}
    for row in ws_m.iter_rows(min_row=2, values_only=True):
        cod = str(row[0]).lstrip('0')
        peso = parse_decimal(row[3])
        maestro[cod] = peso

    # Leer Lista de Precios
    wb_l = openpyxl.load_workbook(LISTA)
    ws_l = wb_l.active

    productos = []
    rubros_set = set()

    for row in ws_l.iter_rows(min_row=2, values_only=True):
        cod = str(row[0]).lstrip('0')
        descripcion = str(row[1]) if row[1] else ""
        rubro = clean_rubro(row[2])
        um_precio = str(row[3]) if row[3] else "unidad"
        precio_unit_iva = parse_decimal(row[6])    # Precio Venta con IVA (unidad)
        um_pred = str(row[7]) if row[7] else ""
        precio_pred_iva = parse_decimal(row[10])   # Precio Pred Venta con IVA

        if cod not in maestro:
            continue

        peso_unitario = maestro[cod]
        pack_qty = extract_pack_qty(um_pred)

        rubros_set.add(rubro)

        productos.append({
            "codigo": cod,
            "descripcion": descripcion,
            "rubro": rubro,
            "peso_unit_kg": round(peso_unitario, 4),
            "precio_unit_iva": round(precio_unit_iva, 2),
            "um_pred": um_pred if um_pred else "unidad",
            "pack_qty": pack_qty,
            "precio_pred_iva": round(precio_pred_iva, 2),
        })

    # Ordenar por rubro y descripcion
    productos.sort(key=lambda p: (p["rubro"], p["descripcion"]))
    rubros = sorted(rubros_set)

    # Tarifas de flete
    tarifas = {
        "Bariloche": {
            "tipo": "peso",
            "listas": {
                "A": 75.0,
                "B": 230.0
            }
        },
        "Cervantes": {
            "tipo": "peso",
            "listas": {
                "A": 75.0,
                "B": 150.0,
                "C": 275.0
            }
        },
        "Santa Rosa": {
            "tipo": "porcentaje",
            "listas": {
                "A": 0.03,
                "B": 0.05,
                "C": 0.07
            }
        }
    }

    # Generar data.js
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        f.write("// Generado automáticamente por generar_datos.py\n")
        f.write("// NO EDITAR MANUALMENTE\n\n")
        f.write(f"const PRODUCTOS = {json.dumps(productos, ensure_ascii=False, indent=2)};\n\n")
        f.write(f"const RUBROS = {json.dumps(rubros, ensure_ascii=False, indent=2)};\n\n")
        f.write(f"const TARIFAS = {json.dumps(tarifas, ensure_ascii=False, indent=2)};\n")

    print(f"Generado: {OUTPUT}")
    print(f"Productos: {len(productos)}")
    print(f"Rubros: {len(rubros)}")


if __name__ == "__main__":
    main()
