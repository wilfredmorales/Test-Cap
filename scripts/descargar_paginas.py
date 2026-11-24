"""Descarga las páginas públicas del banco de preguntas del Ministerio de Transportes
(CAP y competencia profesional) y las guarda tal cual en raw/ para procesarlas después."""
import hashlib, json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

BASE = "https://www.transportes.gob.es"
SEMILLAS = [
    "/transporte-terrestre/examenes-y-formacion/examenes-de-formacion-de-conductores-profesionales-cap",
    "/transporte-terrestre/examenes-y-formacion/examenes-de-formacion-de-conductores-profesionales-cap/seccion1-objetivo1_1",
    "/transporte-terrestre/examenes-y-formacion/competencia-profesional",
    "/transporte-terrestre/examenes-y-formacion/competencia-profesional/preguntas-mercancias",
    "/transporte-terrestre/examenes-y-formacion/competencia-profesional/preguntas-mercancias/elementos-derecho-civil",
    "/transporte-terrestre/examenes-y-formacion/competencia-profesional/preguntas-viajeros",
]
PERMITIDOS = (
    "/transporte-terrestre/examenes-y-formacion/examenes-de-formacion-de-conductores-profesionales-cap",
    "/transporte-terrestre/examenes-y-formacion/competencia-profesional",
    "/areas-de-actividad/transporte-terrestre/servicios-al-transportista/cap",
    "/transporte-terrestre/servicios-al-transportista/competencia-profesional",
)
MAX_PAGINAS = 400
SALIDA = Path("raw")


def nombre(ruta):
    limpio = re.sub(r"[^A-Za-z0-9_-]+", "_", ruta.strip("/"))[-120:]
    return f"{limpio}_{hashlib.sha1(ruta.encode()).hexdigest()[:8]}"


def bajar(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (banco-preguntas-cap)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.headers.get("Content-Type", ""), r.read()


def main():
    SALIDA.mkdir(exist_ok=True)
    pendientes, vistos, indice = list(SEMILLAS), set(), []
    while pendientes and len(vistos) < MAX_PAGINAS:
        ruta = pendientes.pop(0)
        if ruta in vistos:
            continue
        vistos.add(ruta)
        url = BASE + ruta
        try:
            status, tipo, cuerpo = bajar(url)
        except Exception as e:
            indice.append({"url": url, "error": str(e)})
            print("ERROR", url, e, file=sys.stderr)
            continue
        es_html = "html" in tipo
        ext = ".html" if es_html else Path(urllib.parse.urlparse(url).path).suffix or ".bin"
        archivo = SALIDA / (nombre(ruta) + ext)
        archivo.write_bytes(cuerpo)
        indice.append({"url": url, "status": status, "tipo": tipo, "archivo": archivo.name, "bytes": len(cuerpo)})
        print(status, len(cuerpo), url)
        if es_html:
            html = cuerpo.decode("utf-8", "replace")
            for href in re.findall(r'href="([^"#]+)"', html):
                abs_url = urllib.parse.urljoin(url, href)
                p = urllib.parse.urlparse(abs_url)
                if p.netloc not in ("www.transportes.gob.es", "transportes.gob.es"):
                    continue
                r = p.path.rstrip("/")
                if r.startswith(PERMITIDOS) and r not in vistos:
                    pendientes.append(r)
        time.sleep(1)
    (SALIDA / "indice.json").write_text(json.dumps(indice, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Total: {len(indice)} páginas")


if __name__ == "__main__":
    main()
