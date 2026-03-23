# Mando'a Translator + Dictionary

This app uses `MandoaApril09.xls` to provide:

- Bidirectional translation (`Mando'a <-> English`)
- Searchable dictionary with pronunciation
- Light/dark theme toggle
- Inferred plural entries (marked as `Inferred plural`) based on observed singular/plural parsing patterns in the source data

## Run

1. Open `index.html` in your browser.
2. Use **Translator** for phrase/word translation.
3. Use **Dictionary** to search entries.

## Files

- `index.html` - app UI
- `styles.css` - styling
- `app.js` - translation/search logic
- `data/dictionary.json` - cleaned export from spreadsheet
- `data/dictionary.js` - dictionary data bundle used by browser
- `scripts/export-dictionary.ps1` - regenerate dictionary files from `.xls`

## Refresh Data

From the `mandoa-translator` folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-dictionary.ps1
```

Optional custom spreadsheet path:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-dictionary.ps1 -SpreadsheetPath "C:\path\to\MandoaApril09.xls"
```
