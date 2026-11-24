"""Copia el icono de la app a los recursos de Android (sustituye el icono por defecto de Capacitor)."""
from pathlib import Path
from PIL import Image

RES = Path("android/app/src/main/res")
TAM = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
src = Image.open("icons/icon-512.png").convert("RGBA")
for d, s in TAM.items():
    carpeta = RES / f"mipmap-{d}"
    carpeta.mkdir(parents=True, exist_ok=True)
    img = src.resize((s, s), Image.LANCZOS)
    for nombre in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
        img.save(carpeta / nombre)
# Quitar el icono adaptativo por defecto, que taparía el nuestro.
for f in (RES / "mipmap-anydpi-v26").glob("*.xml"):
    f.unlink()
print("Iconos Android listos")
