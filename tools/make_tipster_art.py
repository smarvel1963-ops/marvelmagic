"""
SAVE AS: make_tipster_art.py   LOCATION: C:/MarvelApps/marvelmagic/tools/make_tipster_art.py
Cuts Marvel (the mascot) out of Scott's sheets in C:/MarvelApps/docs/marvelmagic_mascot_2026-11-23/ into square
256x256 webp pictures for the Tipster (img/tipster/<name>.webp). Each one keeps its own soft background and is shown
in a circle, so nothing has to be cut out by hand. Run again after a sheet changes:  python tools/make_tipster_art.py
"""
from pathlib import Path
from PIL import Image

SRC = Path(r"C:/MarvelApps/docs/marvelmagic_mascot_2026-11-23")
OUT = Path(__file__).resolve().parent.parent / "img" / "tipster"
SHEET, DRESS, HOLI = "Marvel Magic Mascot Character Sheet.png", "dress_up_collection.png", "holiday_collection.png"
# name: (sheet, centre x, top, bottom) - a square from top to just above the character's label, centred on him
BOX = {
    "hello":     (SHEET, 128, 350, 508),
    "thumbs":    (SHEET, 122, 548, 682),
    "thinking":  (SHEET, 978, 122, 316),
    "remote":    (SHEET, 950, 368, 574),
    "search":    (SHEET, 140, 713, 866),
    "movie":     (SHEET, 408, 706, 866),
    "sports":    (SHEET, 688, 706, 866),
    "calendar":  (SHEET, 978, 704, 866),
    "tv":        (SHEET, 175, 916, 1094),
    "party":     (SHEET, 553, 916, 1094),
    "guide":     (SHEET, 830, 916, 1094),
    "director":  (DRESS, 200, 210, 628),
    "commentator": (DRESS, 562, 215, 628),
    "detective": (DRESS, 935, 215, 628),
    "explorer":  (DRESS, 190, 790, 1205),
    "streamer":  (DRESS, 915, 790, 1205),
    "christmas": (HOLI, 192, 330, 664),
    "halloween": (HOLI, 560, 330, 664),
    "thanksgiving": (HOLI, 928, 330, 664),
    "newyear":   (HOLI, 192, 850, 1205),
    "valentine": (HOLI, 560, 850, 1205),
    "july4":     (HOLI, 928, 850, 1205),
}
WHOLE = {"easter": "holiday_easter.png", "stpatricks": "holiday_st_patricks.png"}   # true see-through pictures: put on a soft disc

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (sheet, cx, top, bot) in BOX.items():
        src = Image.open(SRC / sheet).convert("RGB"); size = bot - top
        x = min(max(0, cx - size // 2), src.width - size)
        im = src.crop((x, top, x + size, bot)).resize((256, 256), Image.LANCZOS)
        im.save(OUT / f"{name}.webp", "WEBP", quality=86, method=6)
    for name, f in WHOLE.items():
        im = Image.open(SRC / f).convert("RGBA"); im.thumbnail((236, 236), Image.LANCZOS)
        bg = Image.new("RGBA", (256, 256), (238, 234, 252, 255)); bg.alpha_composite(im, ((256 - im.width) // 2, (256 - im.height) // 2 + 6))
        bg.convert("RGB").save(OUT / f"{name}.webp", "WEBP", quality=86, method=6)
    names = list(BOX) + list(WHOLE)
    cols = 8; sheet = Image.new("RGB", (cols * 132, ((len(names) + cols - 1) // cols) * 132), (20, 16, 40))
    for i, n in enumerate(names):
        sheet.paste(Image.open(OUT / f"{n}.webp").resize((128, 128)), ((i % cols) * 132 + 2, (i // cols) * 132 + 2))
    return sheet

if __name__ == "__main__":
    import sys
    s = main()
    if len(sys.argv) > 1: s.save(sys.argv[1])
    print("made", len(BOX) + len(WHOLE), "pictures in", OUT)
