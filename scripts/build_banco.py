"""Genera data/banco-cap.json y data/version.json a partir del ZIP de .txt del banco CAP.

Uso: python scripts/build_banco.py [ruta.zip]   (por defecto, el ZIP más reciente de fuentes/)
Falla (código 1) si alguna pregunta no tiene 4 opciones o respuesta válida,
para no publicar nunca un banco mal leído.
"""
import hashlib, json, re, sys, zipfile
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from parse_txt import parse  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent

SECCIONES = {
    "1": "Formación obligatoria común",
    "2": "Formación obligatoria mercancías",
    "3": "Formación obligatoria viajeros",
    "4": "Formación complementaria mercancías",
    "4-5": "Formación complementaria común",
    "5": "Formación complementaria viajeros",
}
TITULOS = {
    "1.1": "Conocer las características de la cadena cinemática para optimizar su utilización",
    "1.2": "Conocer las características técnicas y el funcionamiento de los dispositivos de seguridad",
    "1.3": "Poder optimizar el consumo de carburante",
    "1.3BIS": "Ser capaz de anticipar y evaluar los riesgos del tráfico y de adaptarse a ellos",
    "2.1": "Conocer el entorno social del transporte por carretera y su reglamentación",
    "3.1": "Tener conciencia de los riesgos de la carretera y los accidentes de trabajo",
    "3.2": "Ser capaz de prevenir la delincuencia y el tráfico de inmigrantes clandestinos",
    "3.3": "Ser capaz de prevenir los riesgos físicos",
    "3.4": "Tener conciencia de la importancia de la aptitud física y mental",
    "3.5": "Tener capacidad para evaluar situaciones de emergencia",
    "3.6": "Poder adoptar comportamientos que contribuyan a valorar la imagen de marca de una empresa",
    "1.4": "Ser capaz de realizar una operación de carga respetando las consignas de seguridad",
    "2.2": "Conocer la reglamentación en materia de transporte de mercancías",
    "3.7": "Conocer el entorno económico del transporte de mercancías y la organización del mercado",
    "1.5": "Poder garantizar la seguridad y la comodidad de los pasajeros",
    "1.6": "Ser capaz de realizar una operación de carga respetando las consignas de seguridad",
    "2.3": "Conocer la reglamentación relativa al transporte de viajeros",
    "3.8": "Conocer el entorno económico del transporte de viajeros y la organización del mercado",
    "M7V4": "Sensibilización y educación vial",
    "M8V5": "Tacógrafo digital",
}


def leer_zip(ruta):
    archivos = {}
    fecha = None
    with zipfile.ZipFile(ruta) as z:
        for info in z.infolist():
            nombre = info.filename
            if not nombre.lower().endswith(".txt"):
                continue
            try:  # los ZIP de Windows suelen guardar los nombres en CP437
                if not info.flag_bits & 0x800:
                    nombre = nombre.encode("cp437").decode("utf-8")
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass
            archivos[nombre] = z.read(info).decode("utf-8-sig")
            d = datetime(*info.date_time)
            fecha = max(fecha, d) if fecha else d
    return archivos, fecha


def main():
    activo = RAIZ / "fuentes" / "ACTIVO.txt"
    if len(sys.argv) > 1:
        zip_path = Path(sys.argv[1])
    elif activo.exists() and activo.read_text(encoding="utf-8").strip():
        # El ZIP activo lo elige el administrador desde la app (publicar o volver a una versión).
        nombre = activo.read_text(encoding="utf-8").strip()
        if "/" in nombre or "\\" in nombre or not nombre.lower().endswith(".zip"):
            sys.exit(f"ACTIVO.txt no válido: {nombre!r}")
        zip_path = RAIZ / "fuentes" / nombre
        if not zip_path.exists():
            sys.exit(f"ACTIVO.txt apunta a un ZIP que no existe: {nombre}")
    else:
        # El más reciente según la fecha de los .txt de dentro (la fecha del archivo
        # en disco no sirve: en un checkout de git todos tienen la misma).
        def fecha_zip(p):
            with zipfile.ZipFile(p) as z:
                return max((i.date_time for i in z.infolist()), default=(0,))
        zips = sorted((RAIZ / "fuentes").glob("*.zip"), key=lambda p: (fecha_zip(p), p.name))
        if not zips:
            sys.exit("No hay ZIP en fuentes/")
        zip_path = zips[-1]
    archivos, fecha = leer_zip(zip_path)

    objetivos, preguntas, errores = [], [], []
    for nombre in sorted(archivos):
        partes = Path(nombre).parts
        m = re.search(r"Secci[oó]n\s*([\d;]+)", nombre, re.I)
        seccion = m.group(1).replace(";", "-") if m else "?"
        obj = Path(partes[-1]).stem.upper()
        qs, probs = parse(archivos[nombre])
        errores += [f"{nombre} COD {c}: {msg}" for c, msg, _ in probs]
        objetivos.append({"id": obj, "seccion": seccion, "titulo": TITULOS.get(obj, obj), "n": len(qs)})
        for q in qs:
            item = {"c": q["cod"], "o": obj, "p": q["pregunta"],
                    "a": [o["texto"] for o in q["opciones"]], "r": q["respuesta"]}
            if q["norma"]:
                item["n"] = q["norma"]
            if q["referencia"] and q["referencia"] != q["norma"]:
                item["f"] = q["referencia"]
            preguntas.append(item)

    if errores:
        print("ERRORES: no se publica el banco.\n" + "\n".join(errores[:50]))
        sys.exit(1)

    orden = {k: i for i, k in enumerate(SECCIONES)}
    objetivos.sort(key=lambda o: (orden.get(o["seccion"], 99), o["id"]))
    # Mismo cálculo que textoCanonico() en app.js, para que la versión coincida.
    canon = "\n".join("\x1f".join([q["c"], q["o"], q["p"], *q["a"], q["r"]])
                      for q in sorted(preguntas, key=lambda q: q["c"]))
    version = hashlib.sha256(canon.encode()).hexdigest()[:12]
    meta = {
        "version": version,
        "fechaFuente": fecha.date().isoformat() if fecha else None,
        "generado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fuente": zip_path.name,
        "total": len(preguntas),
        "secciones": SECCIONES,
        "objetivos": objetivos,
    }
    previo = RAIZ / "data" / "version.json"
    if previo.exists() and json.loads(previo.read_text(encoding="utf-8")).get("version") == version:
        print(f"Sin cambios: el banco ya está en la versión {version}")
        return
    (RAIZ / "data").mkdir(exist_ok=True)
    (RAIZ / "data" / "banco-cap.json").write_text(
        json.dumps({**meta, "preguntas": preguntas}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (RAIZ / "data" / "version.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OK: {len(preguntas)} preguntas, {len(objetivos)} objetivos, versión {version}")
    for o in objetivos:
        print(f"  Sección {o['seccion']:>3}  {o['id']:<7} {o['n']:>4}")


if __name__ == "__main__":
    main()
