const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendAccessRequest: (data) => ipcRenderer.send('send-access-request', data),
  googleLogin: () => ipcRenderer.invoke('google-login'),
  getSheetData: () => ipcRenderer.invoke('fetch-sheet-data'),
  reserve: (payload) => ipcRenderer.invoke('submit-reservation', payload),
  cancel: (payload) => ipcRenderer.invoke('submit-cancellation', payload),
  checkLoginStatus: () => ipcRenderer.invoke('check-login-status'),
  toggleGoogleLogin: () => ipcRenderer.invoke('toggle-google-login'),
  onRegainFocus: (callback) => ipcRenderer.on('regain-focus', callback)
});

contextBridge.exposeInMainWorld('dataUtils', {
  processRawReservations: (data, targetDateStr) => {
    const result = [];

    data.slice(1).forEach(row => {
      if (!row[4] || !row[5]) return;

      const name = row[1];
      const id = typeof row[2] === 'number' ? row[2].toFixed(0) : row[2];
      const start = parseKoreanDatetime(row[4]);
      const end = parseKoreanDatetime(row[5]);
      const note = row[6] || "";
      const approval = row[7] || "";
      const reason = row[8] || "";

      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

      const startDate = formatDate(start);
      const endDate = formatDate(end);
      const timeStart = formatTime(start);
      const timeEnd = formatTime(end);
      const targetDate = new Date(targetDateStr);
      const startDay = new Date(startDate);
      const endDay = new Date(endDate);

      if (targetDate < startDay || targetDate > endDay) return;

      let status = "예약확정";
      if (!approval.trim() || reason.includes("취소") || reason.includes("승인거부")) {
        status = "예약취소";
      }

      result.push([
        status,                             // 0
        name,                               // 1
        id,                                 // 2
        `${timeStart} ~ ${timeEnd}`,        // 3
        approval || "-",                    // 4
        reason || "-",                      // 5
        startDate,                          // 6
        timeStart,                          // 7
        endDate,                            // 8
        timeEnd,                            // 9
        row[0]                              // 10 (timestamp)
      ]);
    });

    return result;
  },

  processAllReservations: (data) => {
    const result = [];

    data.slice(1).forEach(row => {
      if (!row[4] || !row[5]) return;

      const name = row[1];
      const id = typeof row[2] === 'number' ? row[2].toFixed(0) : row[2];
      const start = parseKoreanDatetime(row[4]);
      const end = parseKoreanDatetime(row[5]);
      const note = row[6] || "";
      const approval = row[7] || "";
      const reason = row[8] || "";

      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

      const startDate = formatDate(start);
      const endDate = formatDate(end);
      const timeStart = formatTime(start);
      const timeEnd = formatTime(end);

      let status = "예약확정";
      if (!approval.trim() || reason.includes("취소") || reason.includes("승인거부")) {
        status = "예약취소";
      }

      result.push([
        status, name, id,
        `${timeStart} ~ ${timeEnd}`, approval || "-", reason || "-",
        startDate, timeStart, endDate, timeEnd
      ]);
    });

    return result;
  }
});

function formatDate(date) {
  const offset = 9 * 60 * 60 * 1000;
  const local = new Date(date.getTime() + offset);
  return local.toISOString().split("T")[0];
}

function formatTime(date) {
  return date.getHours().toString().padStart(2, "0") + ":" +
         date.getMinutes().toString().padStart(2, "0");
}

function parseKoreanDatetime(str) {
  if (!str || typeof str !== "string") return new Date(NaN);

  const match = str.match(/(\d{4})\. (\d{1,2})\. (\d{1,2}) (오전|오후) (\d{1,2}):(\d{2}):?(\d{2})?/);
  if (!match) return new Date(NaN);

  const [, year, month, day, ampm, hourStr, minuteStr] = match;

  let hour = parseInt(hourStr, 10);
  if (ampm === "오후" && hour !== 12) hour += 12;
  if (ampm === "오전" && hour === 12) hour = 0;

  const minute = parseInt(minuteStr, 10);
  return new Date(Number(year), Number(month) - 1, Number(day), hour, minute);
}
