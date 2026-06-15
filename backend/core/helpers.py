"""
Funciones de utilidad compartidas entre rutas.
"""
from datetime import datetime, date, timedelta, time as time_type
from decimal import Decimal
import json


def serialize(obj):
    """
    Serializa objetos Python no-JSON-nativos a tipos JSON compatibles.
    Útil para convertir resultados de pyodbc a JSON.

    IMPORTANTE: pyodbc retorna columnas TIME de SQL Server como
    datetime.timedelta (no como datetime.time). Se maneja ambos casos
    para evitar el error "Tipo no serializable" en endpoints que devuelven
    campos como Hora_Cita, Hora_inic y Hora_final.
    """
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, date):
        return obj.isoformat()
    if isinstance(obj, timedelta):
        # pyodbc retorna columnas TIME de SQL Server como timedelta.
        # Convertimos a string "HH:MM:SS" para uso directo en JS.
        total_seg = int(obj.total_seconds())
        horas   = total_seg // 3600
        minutos = (total_seg % 3600) // 60
        segundos = total_seg % 60
        return f"{horas:02d}:{minutos:02d}:{segundos:02d}"
    if isinstance(obj, time_type):
        # Fallback: algunos drivers retornan datetime.time nativo.
        return obj.strftime('%H:%M:%S')
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Tipo no serializable: {type(obj)}")


def rows_to_json(rows):
    """
    Convierte una lista de dicts (resultado de pyodbc) a JSON seguro.
    """
    return json.loads(json.dumps(rows, default=serialize))


def calcular_politica_cancelacion(fecha_cita: date, hora_cita) -> dict:
    """
    Calcula el porcentaje de devolución según la política de cancelación.

    Reglas:
      ≥ 48h antes → 100% devuelto
      ≥ 24h antes → 50% devuelto
      < 24h antes → 0% devuelto

    :param fecha_cita: Fecha de la cita (date)
    :param hora_cita:  Hora de la cita (time o timedelta)
    :return: dict con 'porcentaje' y 'politica' (etiqueta)
    """
    # Construir datetime completo de la cita
    if isinstance(hora_cita, timedelta):
        segundos = int(hora_cita.total_seconds())
        hora_cita = (datetime.min + hora_cita).time()

    cita_dt = datetime.combine(fecha_cita, hora_cita)
    ahora = datetime.now()
    diferencia = cita_dt - ahora

    horas_restantes = diferencia.total_seconds() / 3600

    if horas_restantes >= 48:
        return {'porcentaje': 100, 'politica': '100%',
                'descripcion': 'Cancelación con 48h o más de anticipación → reembolso del 100%.'}
    elif horas_restantes >= 24:
        return {'porcentaje': 50, 'politica': '50%',
                'descripcion': 'Cancelación con entre 24h y 48h de anticipación → reembolso del 50%.'}
    else:
        return {'porcentaje': 0, 'politica': '0%',
                'descripcion': 'Cancelación con menos de 24h de anticipación → sin reembolso.'}


def calcular_monto_devolucion(monto_pagado: float, porcentaje: int) -> float:
    """Calcula el monto a devolver según el porcentaje."""
    return round(monto_pagado * porcentaje / 100, 2)


def validar_ventana_cita(fecha_cita: date) -> dict:
    """
    Valida que la fecha de la cita esté dentro de la ventana permitida:
    mínimo 48h y máximo 3 meses desde ahora.

    :return: dict con 'valido' (bool) y 'error' (str) si no es válido
    """
    ahora = datetime.now()
    minima = ahora + timedelta(hours=48)
    maxima = ahora + timedelta(days=90)  # ~3 meses

    cita_dt = datetime.combine(fecha_cita, datetime.min.time())

    if cita_dt < minima:
        return {'valido': False, 'error': 'La cita debe agendarse con al menos 48 horas de anticipación.'}
    if cita_dt > maxima:
        return {'valido': False, 'error': 'La cita no puede agendarse con más de 3 meses de anticipación.'}
    return {'valido': True}


def validar_fecha_nacimiento(fecha_nac_str: str, edad_maxima: int = 120) -> dict:
    """
    Valida una fecha de nacimiento recibida como string 'YYYY-MM-DD'.

    Reglas:
      - Debe tener formato de fecha válido.
      - No puede ser una fecha futura.
      - La edad resultante no puede ser negativa ni mayor a `edad_maxima` años.

    :return: dict con 'valido' (bool), 'error' (str si no es válido)
              y 'edad' (int si es válido).
    """
    try:
        fecha_nac = datetime.strptime(fecha_nac_str, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return {'valido': False, 'error': 'La fecha de nacimiento no tiene un formato válido (YYYY-MM-DD).'}

    hoy = date.today()
    if fecha_nac > hoy:
        return {'valido': False, 'error': 'La fecha de nacimiento no puede ser una fecha futura.'}

    edad = hoy.year - fecha_nac.year - ((hoy.month, hoy.day) < (fecha_nac.month, fecha_nac.day))

    if edad > edad_maxima:
        return {'valido': False, 'error': f'La fecha de nacimiento indica una edad mayor a {edad_maxima} años. Verifica el dato.'}
    if edad < 0:
        return {'valido': False, 'error': 'La fecha de nacimiento es inválida.'}

    return {'valido': True, 'edad': edad}
