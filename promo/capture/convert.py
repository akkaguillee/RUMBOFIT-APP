"""Stills for the video: 3× PNG captures → 2× JPEG (the phone shows ~1.6 px per pt), plus their heights."""
import glob
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REEL = os.path.join(HERE, '..', 'public', 'reel')
for p in sorted(glob.glob(os.path.join(REEL, '*.png'))):
    img = Image.open(p).convert('RGB')
    w, h = img.size
    img.resize((780, round(h * 780 / w)), Image.LANCZOS).save(p[:-4] + '.jpg', quality=92, optimize=True)
    os.remove(p)
sizes = {os.path.basename(p)[:-4]: {'h': round(Image.open(p).size[1] / 2, 1)} for p in sorted(glob.glob(os.path.join(REEL, '*.jpg')))}
json.dump(sizes, open(os.path.join(HERE, '..', 'src', 'reel', 'shots.json'), 'w'), indent=0)
print(len(sizes), 'stills')
