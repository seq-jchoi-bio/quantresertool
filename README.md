# QuantStudio 1 Real-Time PCR System Reservation Application
> 🇰🇷 **한국어 설명은 [README_KR.md](README_KR.md)에서 확인할 수 있습니다.**

![Electron](https://img.shields.io/badge/Built%20with-Electron-47848F?logo=electron\&logoColor=white) ![Google Cloud](https://img.shields.io/badge/Backend-Google%20Cloud-4285F4?logo=google-cloud\&logoColor=white) ![License: MIT](https://img.shields.io/badge/License-MIT-green.svg) ![version](https://img.shields.io/badge/release-1.1.0-blue) ![Status](https://img.shields.io/badge/status-stable-green)
![macOS](https://img.shields.io/badge/macOS-supported-0078D6?logo=apple\&logoColor=white) ![Windows](https://img.shields.io/badge/Windows-Supported-0078D6?logo=Devian\&logoColor=white)

This is a dedicated booking system for the QuantStudio 1 instrument, developed using Google Sheets API and Electron. It runs on both Windows and macOS, and restricts access via Google login.

---

## Features

* Google login-based user authentication
* Real-time equipment booking and cancellation
* Reservation lookup via approval codes
* Visual timeline view for each day
* Booking lookup based on student/staff ID
* Excel (xlsx) export of booking records
* Desktop app support for Windows/macOS (Electron-based)

---

## Installation Files

| OS      | Filename                            | Download                                                                                                                  | MD5                              |
| ------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| macOS   | `QuantReserTool-1.1.0.dmg`          | [📥 Download](https://github.com/seq-jchoi-bio/quantresertool/releases/download/v1.1.0/QuantReserTool-1.0.0.dmg) | 31085e3f1b5c626005446a8c7c5f92ee |
| Windows | `QuantReserTool-1.1.0-Portable.exe` | [📥 Download](https://github.com/seq-jchoi-bio/quantresertool/releases/download/v1.1.0/QuantReserTool-1.1.0-Portable.exe)          | 6205ab2839594a4f4ec226a408d62d9d |

> ⚠️ Linux is currently not supported.

> ⚠️ Check MD5 if you suspect file corruption.

---

## Documentation & Manuals

* [📘 User Guide (Korean)](https://github.com/seq-jchoi-bio/quantresertool/blob/main/docs/manual.pdf)
* [⚙️ Instrument Operation Guide (Korean)](https://github.com/seq-jchoi-bio/quantresertool/blob/main/docs/device.pdf)
* [📄 Official Instrument Manual (English)](https://github.com/seq-jchoi-bio/quantresertool/blob/main/docs/device_manual.pdf)

---

## (Advanced) Running and Developing the App with Electron

**⚠️ Note: This version does not include Google authentication logic.**
**Node.js must be installed beforehand.**

### Installing Dependencies and Running

Run the following commands in the root directory of the app:

```bash
npm install                             # Install dependencies (both dependencies and devDependencies)
npm install --save-dev electron-builder # Install electron-builder and native module support
tnpx electron .                          # Run the app

# (optional) Build the app
npm run dist
```

### Configuration and Security Notes

This app uses the standard **Google OAuth 2.0 authentication flow** (non-PKCE).

All credentials and configuration data are encrypted with **AES-256**, and decrypted dynamically at runtime.

The decryption logic is included in `main.js`, and the public code contains a blank value for the key.

> ⚠️ **Important: Never hardcode the following sensitive data into scripts:**
>
> * Google OAuth2 Client ID
> * Google Sheets API target Spreadsheet ID
> * Web App Script URL (for booking/cancellation handling)

### Encryption Process

1. Create a file named `config.json`:

```json
{
  "CLIENT_ID": "your-client-id",
  "CLIENT_SECRET": "your-secret",
  "REDIRECT_URI": "your-redirect-uri",
  "SHEET_ID_LOG": "your-log-sheet-id",         // optional
  "SHEET_ID_WHITELIST": "your-whitelist-id"   // optional
}
```

2. Create an encryption script `encrypt-config.js`:

```js
const crypto = require('crypto');
const fs = require('fs');

const key = crypto.createHash('sha256').update('your-encryption-key').digest();
const iv = crypto.randomBytes(16);

const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
const input = fs.readFileSync('config.json');
const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);

const result = Buffer.concat([iv, encrypted]);
fs.writeFileSync('config.enc', result);
console.log('Encrypted config saved to config.enc');
```

3. Run the script to encrypt your config:

```bash
node encrypt-config.js
```

4. When packaging the app, **only include `config.enc`**.

> Do not include `config.json` or `encrypt-config.js` in the repository or final app bundle.

---

## Directory Structure

```plaintext
├── main.js              # Electron main process
├── preload.js           # Main-renderer bridge via contextBridge
├── index.html           # User interface
├── mock.js              # For testing
├── assets/              # Logo images
├── package.json         # Project config
├── docs/                # Manuals
└── README.md            # Documentation
```

---

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).

---

## Developer

* **Name**: Janghyun Choi, Ph. D.
* **Affiliation**: Department of Biological Sciences, Inha University
* **GitHub**: [Main Repository and Developer Profile](https://github.com/seq-jchoi-bio)
