# QuantStudio 1 Real-Time PCR System 예약 프로그램
> 🇺🇸 **For English version, please refer to [README.md](README.md).**

![Electron](https://img.shields.io/badge/Built%20with-Electron-47848F?logo=electron&logoColor=white) ![Google Cloud](https://img.shields.io/badge/Backend-Google%20Cloud-4285F4?logo=google-cloud&logoColor=white) ![License: MIT](https://img.shields.io/badge/License-MIT-green.svg) ![version](https://img.shields.io/badge/release-1.1.0-blue) ![Status](https://img.shields.io/badge/status-stable-green)
![macOS](https://img.shields.io/badge/macOS-supported-0078D6?logo=apple&logoColor=white) ![Windows](https://img.shields.io/badge/Windows-Supported-0078D6?logo=Devian&logoColor=white)

Google Sheets API와 Electron을 활용하여 개발된 **QuantStudio 1 장비 전용 예약 시스템**입니다.  
Windows / macOS 모두에서 실행 가능하며, Google 로그인 기반으로 접근을 제한합니다.

---

## 주요 기능

- Google 로그인 기반 사용자 인증
- 실시간 장비 예약 및 취소 처리
- 승인번호 기반 예약 확인
- 날짜별 타임라인 예약 시각화
- 학번/사번 기반 예약 조회
- 예약 기록 Excel(xlsx) 저장
- Windows/macOS 데스크탑 앱 지원 (Electron 기반)

---

## 설치 파일

| 운영체제 | 파일명 | 다운로드 | MD5 |
|----------|--------|----------|----------|
| macOS  | `QuantReserTool-1.1.0.dmg` | [📥 다운로드](https://github.com/seq-jchoi-bio/quantresertool/releases/download/v1.1.0/QuantReserTool-1.1.0-Portable.exe) | 31085e3f1b5c626005446a8c7c5f92ee |
| Windows    | `QuantReserTool-1.1.0-Portable.exe` | [📥 다운로드](https://github.com/seq-jchoi-bio/quantresertool/releases/download/v1.1.0/QuantReserTool-1.1.0-Portable.exe) | 6205ab2839594a4f4ec226a408d62d9d |

> ⚠️ Linux는 현재 지원되지 않습니다.

> ⚠️ 파일 손상시 MD5를 비교해보세요.

---

## 문서 및 매뉴얼

- [📘 예약 프로그램 사용법(한국어)](https://github.com/seq-jchoi-bio/quantresertool/blob/main/docs/manual.pdf)
- [⚙️ 장비 사용법(한국어)](https://github.com/seq-jchoi-bio/quantresertool/blob/main/docs/device.pdf)
- [📄 장비 공식 매뉴얼(영어)](https://github.com/seq-jchoi-bio/quantresertool/blob/main/docs/device_manual.pdf)

---

## (고급, 선택) Electron을 통한 프로그램 실행 및 개발

**⚠️ 주의: 이 버전에는 Google 인증 관련 코드가 포함되어 있지 않습니다.**  
**Node.js가 반드시 설치되어 있어야 합니다.**

### 의존성 설치 및 실행

앱 폴더 최상단에서 아래의 코드를 사용해 패키지를 설치합니다:
```bash
npm install # 패키지 설치 (dependencies + devDependencies)
npm install --save-dev electron-builder # 네이티브 모듈 등 추가 의존성 설치
npx electron . # 앱 실행

 # (optional) App packaging (build)
npm run dist
```

### 환경 설정 및 보안 주의사항

이 앱은 Google OAuth 2.0 기반의 표준 인증 흐름을 사용합니다(non-PKCE).

모든 인증 정보 및 주요 설정 데이터는 **AES-256 방식으로 암호화**되어 있으며,  
앱 실행 시 복호화를 통해 동적으로 처리됩니다.

main.js에는 복호화 로직이 포함되어 있으며,
공개된 코드에서는 복호화 키 값을 공란으로 처리하였습니다.

> ⚠️ **중요: 다음과 같은 민감 정보는 스크립트에 하드코딩되어 있지 않아야 합니다.**

- Google OAuth2 Client ID  
- Google Sheets API 대상 Spreadsheet ID  
- Web App Script URL (예약/취소 처리용)

### 암호화 과정

- 다음과 같이 `config.json` 파일을 생성합니다.
```json
{
  "CLIENT_ID": "클라이언트 아이디",
  "CLIENT_SECRET": "시크릿",
  "REDIRECT_URI": "리다이렉트",
  "SHEET_ID_LOG": "데이터주소", // 옵션
  "SHEET_ID_WHITELIST": "허용리스트" // 옵션
}
```

- 다음은 암호화를 위한 자바스크립트 코드입니다(`encrypt-config.js`). 
- 암호화에 사용할 강력한 비밀번호를 설정하세요(대소문자, 숫자, 특수문자 포함 권장).

```js
const crypto = require('crypto');
const fs = require('fs');

const key = crypto.createHash('sha256').update('사용할암호키').digest();
const iv = crypto.randomBytes(16);

const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
const input = fs.readFileSync('config.json');
const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);

const result = Buffer.concat([iv, encrypted]);

fs.writeFileSync('config.enc', result);
console.log('Encrypted config saved to config.enc');
```

- 터미널에서 아래와 같이 입력하면 `config.json` 파일이 암호화되어, `config.enc` 파일을 형성합니다.

```sh
node encrypt-config.js
```

- 앱 패키징시에는 `config.enc` 파일만 포함해야 합니다.
- **`config.json`, `encrypt-config.js` 파일들은 외부에 노출되지 않도록반드시 따로 보관하세요.**

---

## 디렉토리 구조

```plaintext
├── main.js              # Electron 메인 프로세스
├── preload.js           # contextBridge를 통한 메인-렌더러 통신
├── index.html           # 사용자 인터페이스
├── mock.js              # 테스트용
├── assets/              # 로고 이미지
├── package.json         # 프로젝트 설정
├── docs/                # 매뉴얼 문서들
└── README.md            # 설명 문서
```

---

## 라이선스

본 프로젝트는 [MIT License](https://opensource.org/licenses/MIT)에 따라 자유롭게 사용할 수 있습니다.

---

## 개발자 정보

* **Name**: Janghyun Choi, Ph. D.
* **Affiliation**: Department of Biological Sciences, Inha University
* **GitHub**: [Main Repository and Developer Profile](https://github.com/seq-jchoi-bio)
