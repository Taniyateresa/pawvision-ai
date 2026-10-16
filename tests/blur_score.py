import sys
import numpy as np
from PIL import Image, ImageOps


def blur_score(path):
    img = ImageOps.exif_transpose(Image.open(path)).convert("L")
    img.thumbnail((256, 256))
    a = np.asarray(img, dtype=np.float32)
    lap = (4 * a[1:-1, 1:-1] - a[:-2, 1:-1] - a[2:, 1:-1]
           - a[1:-1, :-2] - a[1:-1, 2:])
    return float(lap.var())


for p in sys.argv[1:]:
    print(round(blur_score(p), 1), p)