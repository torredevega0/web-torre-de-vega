"""
Torre de Vega — generador de imágenes adaptativas.

Uso, desde la raíz del proyecto:

    python _herramientas/imagenes_adaptativas.py            # genera lo que falte
    python _herramientas/imagenes_adaptativas.py --limpiar  # y borra versiones sin uso

Lee _herramientas/imagenes.json y, para cada fotografía, crea en assets/img/:
  - varios anchos en WebP (ligero, medio y nítido) llamados clave.HASH-ANCHO.webp,
  - una miniatura difuminada (LQIP) para incrustar en el HTML,
y reescribe _herramientas/imagenes-generadas.json con los valores que usan las páginas:
    data-tdv-src, data-tdv-w, data-tdv-ratio y la miniatura (lqip).

El HASH depende del archivo de origen y de los ajustes: si cambias una foto, cambia el
nombre, y ni el navegador ni el service worker pueden servir la versión antigua.
Requiere Pillow (pip install Pillow).
"""
import base64
import hashlib
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "_herramientas" / "imagenes.json"
VERSION = "1"  # bump to force every image to be regenerated

# Quality for the lightest, middle and sharpest size.
QUALITY_LIGHT, QUALITY_MEDIUM, QUALITY_SHARP = 50, 66, 82
LQIP_WIDTH = 24


def open_source(entry):
    path = ROOT / entry["origen"]
    image = Image.open(path)
    image.load()
    image = image.convert("RGBA")
    if entry.get("recorte_alfa"):
        box = image.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        if box:
            pad = round(max(image.size) * 0.02)
            image = image.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(image.width, box[2] + pad), min(image.height, box[3] + pad)))
    if image.getchannel("A").getextrema()[0] == 255:
        image = image.convert("RGB")
    return path, image


def widths_for(source_width, group_widths):
    top = min(source_width, group_widths[-1])
    return sorted({w for w in group_widths if w < top} | {top})


def quality_for(index, count):
    if index == count - 1:
        return QUALITY_SHARP
    return QUALITY_LIGHT if index == 0 else QUALITY_MEDIUM


def lqip(image):
    small = image.copy()
    small.thumbnail((LQIP_WIDTH, LQIP_WIDTH * 8), Image.LANCZOS)
    small = small.filter(ImageFilter.GaussianBlur(0.6))
    buffer = io.BytesIO()
    small.save(buffer, "WEBP", quality=35, method=6)
    return "data:image/webp;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def main():
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    out_root = ROOT / config["salida"]
    manifest_path = ROOT / config["manifiesto"]
    manifest = {}
    written = 0
    total_bytes = 0

    for entry in config["imagenes"]:
        key = entry["clave"]
        group = config["grupos"][key.split("/")[0]]
        path, image = open_source(entry)
        widths = widths_for(image.width, group["anchos"])
        digest = hashlib.sha1(path.read_bytes() + json.dumps([entry, widths, VERSION, QUALITY_LIGHT, QUALITY_MEDIUM, QUALITY_SHARP], sort_keys=True).encode()).hexdigest()[:8]
        target_dir = (out_root / key).parent
        stem = Path(key).name
        target_dir.mkdir(parents=True, exist_ok=True)

        for index, width in enumerate(widths):
            file = target_dir / f"{stem}.{digest}-{width}.webp"
            if not file.exists():
                resized = image if width == image.width else image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
                resized.save(file, "WEBP", quality=quality_for(index, len(widths)), method=6)
                written += 1
            total_bytes += file.stat().st_size

        # Older versions of this same photograph (another hash) are no longer referenced.
        pattern = re.compile(rf"^{re.escape(stem)}\.(?!{digest})[0-9a-f]{{8}}-\d+\.webp$")
        for old in target_dir.iterdir():
            if pattern.match(old.name):
                old.unlink()

        manifest[key] = {
            "src": f"/{config['salida']}/{key}.{digest}",
            "anchos": widths,
            "ratio": round(image.width / image.height, 4),
            "lqip": lqip(image),
        }
        print(f"{key:40s} {image.width}x{image.height} -> {widths}")

    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")

    if "--limpiar" in sys.argv:
        used = {f"{Path(item['src']).name}-{w}.webp" for item in manifest.values() for w in item["anchos"]}
        for file in out_root.rglob("*.webp"):
            if file.name not in used:
                file.unlink()
                print("borrada", file.relative_to(ROOT))

    print(f"\n{len(manifest)} imágenes, {written} archivos nuevos, {total_bytes // 1024} KB en total. Manifiesto: {manifest_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
