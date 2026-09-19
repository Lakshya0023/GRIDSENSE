"""Regenerate public/textures/plaster.webp — the charcoal plaster wall tile.

The tile carries only the COARSE blotching of the surface. The fine grain is
applied in CSS (--gs-grain), because fine noise is what makes a raster texture
expensive: baking it in pushed the same tile from 22 KB to over 700 KB.

Seamlessness is structural, not fitted: the noise is synthesised by shaping a
white-noise field in the Fourier domain, and the DFT is circular, so the result
wraps exactly at the tile edges. There is no stitching step to get wrong.

The statistics are matched to the reference plaster photograph, which measured
mean luminance 44.5 with a coarse (Gaussian blur r=24) std of 8.6 — a contrast
ratio of ~0.19. We keep that ratio but place the surface at mean 34, which
leaves value headroom above it for panels, borders and elevated cards.

Usage:  python scripts/generate-plaster-texture.py
Deps:   numpy, pillow
"""

import os

import numpy as np
from PIL import Image

SEED = 20260919
SIZE = 512
MEAN = 34.0
STD = 8.2
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "textures", "plaster.webp")


def spectral_noise(n: int, beta: float, rng: np.random.Generator) -> np.ndarray:
    """Periodic noise with a 1/f**beta power spectrum, normalised to unit std."""
    field = np.fft.fft2(rng.normal(size=(n, n)))
    fy = np.fft.fftfreq(n)[:, None]
    fx = np.fft.fftfreq(n)[None, :]
    radius = np.sqrt(fx**2 + fy**2)
    radius[0, 0] = 1e-6  # avoid dividing by the DC term
    field *= radius ** (-beta / 2.0)
    field[0, 0] = 0  # drop DC; the mean is set explicitly below
    out = np.real(np.fft.ifft2(field))
    return (out - out.mean()) / out.std()


def main() -> None:
    rng = np.random.default_rng(SEED)
    # beta=3.2 gives the broad patches; beta=2.0 adds the mid-scale mottling
    # that stops those patches reading as a plain vignette.
    field = 0.78 * spectral_noise(SIZE, 3.2, rng) + 0.42 * spectral_noise(SIZE, 2.0, rng)
    field /= field.std()

    tile = np.clip(MEAN + field * STD, 0, 255).astype(np.uint8)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    # Greyscale by construction, so the wall can never acquire a colour cast.
    Image.fromarray(tile, "L").convert("RGB").save(OUT, "WEBP", quality=94, method=6)

    check = np.asarray(Image.open(OUT).convert("L")).astype(float)
    print("wrote %s  %.1f KB" % (os.path.normpath(OUT), os.path.getsize(OUT) / 1024))
    print("  mean %.1f  std %.1f  (target %.1f / %.1f)" % (check.mean(), check.std(), MEAN, STD))
    print("  wrap discontinuity  L|R %.2f  T|B %.2f  vs neighbour step %.2f" % (
        np.abs(check[:, 0] - check[:, -1]).mean(),
        np.abs(check[0, :] - check[-1, :]).mean(),
        np.abs(check[:, 10] - check[:, 11]).mean(),
    ))


if __name__ == "__main__":
    main()
