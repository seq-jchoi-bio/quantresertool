// Mock reservation data (in-memory only)
let mockReservations = [];

function getReservationsMock(dateStr, callback) {
  const results = mockReservations
    .filter(r => r.date === dateStr)
    .map(r => {
      const status = r.cancelReason ? "예약취소" : "예약확정";
      const timeRange = r.time + " ~ " + calculateEndTime(r.time);
      return [
        status,
        r.name,
        r.id,
        timeRange,
        r.approvalCode || "-",
        r.cancelReason || "-"
      ];
    });
  callback(results);
}

function processReservationMock(data, callback) {
  const today = new Date();
  const count = mockReservations.filter(r => r.date === data.date).length + 1;
  const approvalCode = formatDate(today) + "-" + count;

  mockReservations.push({
    ...data,
    date: data.date,
    time: data.time,
    approvalCode: approvalCode,
    cancelReason: null
  });

  callback();
}

function processCancellationMock(data, callback) {
  for (let r of mockReservations) {
    if (r.approvalCode === data.code) {
      r.cancelReason = "사용자취소;" + data.reason;
      break;
    }
  }
  callback();
}

// Utilities
function formatDate(date) {
  return date.toISOString().split("T")[0].replace(/-/g, "");
}

function calculateEndTime(startTime) {
  const [h, m] = startTime.split(":").map(Number);
  const end = new Date(0, 0, 0, h, m + 180); // add 3 hours
  return end.toTimeString().slice(0, 5);
}
