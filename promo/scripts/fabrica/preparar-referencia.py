"""Prepare the fixed reference or normalize a generated scene without removing its background."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageOps

mode, source, destination = sys.argv[1:4]
if mode not in ("referencia", "resultado"):
    raise SystemExit("Modo inválido")
with Image.open(source) as original:
    original.load()
    image = ImageOps.exif_transpose(original).convert("RGBA")
if mode == "referencia":
    image.thumbnail((480, 480), Image.Resampling.LANCZOS)
    background = Image.new("RGBA", image.size, "white")
    background.alpha_composite(image)
    image = background.convert("RGB")
Path(destination).parent.mkdir(parents=True, exist_ok=True)
image.save(destination, format="PNG")
print(json.dumps({"w": image.width, "h": image.height}))
