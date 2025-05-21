# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2025-05-21

### Changed

- 사용자 정보를 사용자가 관리자 드라이브에 업로드하는 방식 대신 서비스 계정을 통한 업로드 방식으로 전환  
  Changed user data upload from manual admin drive upload to **service account–based upload**
- 서비스 계정 키 암호화 및 내부 로직 재작성  
  Encrypted service account key and refactored internal logic
- 내부 구조 단순화 및 보안 강화  
  Simplified structure and improved security
- OAuth2 인증 후 토큰 저장 및 자동 로그인 개선  
  Enhanced token storage and auto-login after OAuth2 authentication

### Fixed

- 첫 로그인 실패 문제 수정  
  Fixed first login failure issue
- 레이아웃 밀림 현상 해결  
  Resolved layout shifting issue
- 간헐적 멈춤 현상 수정  
  Fixed occasional freezing issue

---

## [1.0.0] - 2025-05-19

### Initial Release

- QuantStudio 1 예약 시스템 첫 공개 릴리스  
  First public release of the QuantStudio 1 Reservation System
- Electron 기반 독립 실행형 앱 (macOS 15 및 Windows 11 최적화)  
  Electron-based standalone app (optimized for macOS 15 and Windows 11)
- Google Cloud API 연동을 통한 실시간 데이터 처리 및 통합 기능 구현  
  Integrated Google Cloud APIs for real-time data and core features

---
