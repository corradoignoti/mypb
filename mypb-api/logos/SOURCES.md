# Brand logos

Logos shown next to each station's `Bandiera`. They are trademarks of their
respective owners and are used only to identify the brand of a station.
Files were downloaded unmodified from Wikimedia Commons:

| File         | Commons source                     |
|--------------|------------------------------------|
| `eni.svg`    | `File:Eni wordmark.svg`            |
| `ip.svg`     | `File:IP Logo.svg`                 |
| `q8.svg`     | `File:Q8 logo.svg`                 |
| `esso.svg`   | `File:Esso textlogo.svg`           |
| `tamoil.svg` | `File:Tamoil.svg`                  |
| `lukoil.svg` | `File:Lukoil company logo.svg`     |
| `repsol.svg` | `File:Repsol logo.svg`             |

To add a brand: drop the file here and map the lowercased `Bandiera` value to
it in `BRAND_LOGOS` in `app.py`. Brands without a logo get a coloured initial
on the client side.
