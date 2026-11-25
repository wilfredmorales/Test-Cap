"""Genera los iconos de Android en android-recursos/ a partir de icons/icon-512.png.

Se ejecuta a mano cuando cambia el icono y el resultado se guarda en el repositorio,
para que la compilación del APK no tenga que instalar Pillow."""
from pathlib import Path
from PIL import Image

import sys
RES = Path(sys.argv[1] if len(sys.argv) > 1 else "android-recursos/res")
TAM = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
src = Image.open("icons/icon-512.png").convert("RGBA")
for d, s in TAM.items():
    carpeta = RES / f"mipmap-{d}"
    carpeta.mkdir(parents=True, exist_ok=True)
    img = src.resize((s, s), Image.LANCZOS)
    for nombre in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
        img.save(carpeta / nombre)
print("Iconos Android listos")
