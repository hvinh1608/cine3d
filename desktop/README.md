# CINE3D Desktop (Windows)

Electron shell that opens the live site `https://cine3d.id.vn` in a native window.

## Dev

```powershell
cd desktop
npm install
npm start
```

## Build `.exe`

```powershell
cd desktop
npm install
npm run dist
```

Outputs in `desktop/dist/`:

- `cine3d-1.0.0-x64.exe` — NSIS installer
- `cine3d-1.0.0-portable.exe` — portable (no install)

Windows may show SmartScreen for unsigned builds — choose **More info → Run anyway**.
