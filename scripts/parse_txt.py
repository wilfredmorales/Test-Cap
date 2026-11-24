"""Convierte los .txt del banco CAP (formato COD / pregunta / A-D / RESPUESTA / NORMA) en JSON."""
import json, re, sys
from pathlib import Path

CAMPOS = ("NORMA:", "REFERENCIA DOCTRINAL:")


def parse(texto):
    texto = texto.replace("\r\n", "\n").replace("\r", "\n").lstrip("﻿")
    bloques = re.split(r"(?m)^COD:\s*", texto)
    preguntas, problemas = [], []
    for b in bloques[1:]:
        lineas = [l.strip() for l in b.split("\n")]
        cod = lineas[0]
        resto = [l for l in lineas[1:] if l]
        enunciado, opciones, respuesta, norma, ref = [], {}, None, "", ""
        actual = None
        for l in resto:
            m = re.match(r"^([A-D])(?:\s+(.*))?$", l) if enunciado else None
            if l.startswith("RESPUESTA:"):
                respuesta = l.split(":", 1)[1].strip().upper()[:1]; actual = "R"
            elif l.startswith("NORMA:"):
                norma = l.split(":", 1)[1].strip(); actual = "N"
            elif l.startswith("REFERENCIA DOCTRINAL:"):
                ref = l.split(":", 1)[1].strip(); actual = "F"
            elif m and m.group(1) not in opciones and respuesta is None and (
                    m.group(1) == "ABCD"[len(opciones)]):
                opciones[m.group(1)] = m.group(2) or ""; actual = m.group(1)
            elif actual is None:
                enunciado.append(l)
            elif actual in "ABCD" and respuesta is None:
                opciones[actual] = (opciones[actual] + " " + l).strip()
            elif actual == "N":
                norma += " " + l
            elif actual == "F":
                ref += " " + l
            else:
                enunciado.append(l) if not opciones else problemas.append((cod, "linea suelta", l))
        q = {"cod": cod, "pregunta": " ".join(enunciado),
             "opciones": [{"letra": k, "texto": v} for k, v in opciones.items()],
             "respuesta": respuesta, "norma": norma, "referencia": ref}
        if len(opciones) != 4: problemas.append((cod, f"{len(opciones)} opciones", ""))
        if respuesta not in opciones: problemas.append((cod, f"respuesta '{respuesta}' no valida", ""))
        if not q["pregunta"]: problemas.append((cod, "sin enunciado", ""))
        preguntas.append(q)
    return preguntas, problemas


if __name__ == "__main__":
    raiz = Path(sys.argv[1])
    total = 0
    for f in sorted(raiz.rglob("*.txt")):
        qs, probs = parse(f.read_text(encoding="utf-8"))
        cods = [q["cod"] for q in qs]
        dup = len(cods) - len(set(cods))
        total += len(qs)
        print(f"{f.relative_to(raiz)}: {len(qs)} preguntas, {len(probs)} problemas, {dup} COD duplicados")
        for p in probs[:5]:
            print("   ", p)
    print("TOTAL", total)
