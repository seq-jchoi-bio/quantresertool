const { app, BrowserWindow, ipcMain, session, Menu } = require('electron');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

function loadEncryptedConfig() {
    const data = fs.readFileSync(path.join(__dirname, 'config.enc'));
    
    // WARNING: The decryption key is intentionally left blank for public distribution.
    // To run this application, you must provide the correct key securely in your environment.
    const key = crypto.createHash('sha256').update('').digest();
    const iv = data.slice(0, 16);
    const encrypted = data.slice(16);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    
    return JSON.parse(decrypted.toString());
}

const config = loadEncryptedConfig();
const CLIENT_ID = config.CLIENT_ID;
const CLIENT_SECRET = config.CLIENT_SECRET;
const REDIRECT_URI = config.REDIRECT_URI;
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
  'profile',
  'email'
];

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const TOKEN_PATH = path.join(app.getPath('userData'), 'token.json');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.on('focus', () => {
      mainWindow.webContents.send('regain-focus');
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  
  app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  
  app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') app.quit();
  });
  
});

async function tryLoadTokenAndLogin() {
  if (fs.existsSync(TOKEN_PATH)) {
    const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oauth2Client.setCredentials(tokenData);

    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data } = await oauth2.userinfo.get();
      return data;
    } catch (err) {
      console.warn('🔁 저장된 토큰 만료 → 새 인증 필요');
    }
  }
  return null;
}

ipcMain.handle('toggle-google-login', async () => {
  if (fs.existsSync(TOKEN_PATH)) {
    fs.unlinkSync(TOKEN_PATH); // remove token

    await session.defaultSession.clearStorageData();
    
    // logout
    const logoutWin = new BrowserWindow({ show: false });
    logoutWin.loadURL('https://accounts.google.com/Logout');

    setTimeout(() => {
      if (!logoutWin.isDestroyed()) logoutWin.close();
    }, 1500);

    return { status: 'loggedOut' };
  } else {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    const authWin = new BrowserWindow({
      width: 500,
      height: 600,
      parent: mainWindow,
      modal: true,
      show: true,
      frame: true,
      titleBarStyle: "default",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    authWin.loadURL(authUrl);

    return new Promise((resolve, reject) => {
      authWin.webContents.on('will-redirect', async (event, urlStr) => {
        const url = new URL(urlStr);
        const code = url.searchParams.get('code');
        if (!code) return;

        event.preventDefault();

        try {
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);

          const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
          const userInfo = await oauth2.userinfo.get();
          
          const whitelist = await getWhitelist(oauth2Client);
          if (!whitelist.includes(userInfo.data.email)) {
              authWin.close();
              return resolve({ status: 'notAllowed', user: userInfo.data });
          }

          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
          await logUserToMonthlySpreadsheet(oauth2Client, userInfo.data);

          authWin.close();
          resolve({ status: 'loggedIn', user: userInfo.data });
        } catch (err) {
          console.error('❌ 로그인 실패:', err.message);
          authWin.close();
          reject(new Error('로그인 중 오류가 발생했습니다. 다시 시도해주세요.'));
        }
      });

      setTimeout(() => {
        if (!authWin.isDestroyed()) authWin.close();
        reject(new Error('⏱️ 로그인 시간이 초과되었습니다.'));
      }, 90 * 1000);
    });
  }
});

ipcMain.handle('check-login-status', async () => {
  if (!fs.existsSync(TOKEN_PATH)) return { loggedIn: false };

  try {
    const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oauth2Client.setCredentials(tokenData);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    return { loggedIn: true, user: data };
  } catch (err) {
    return { loggedIn: false };
  }
});

ipcMain.handle('fetch-sheet-data', async () => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SHEET_ID_LOG,
      range: 'ResponseTable',
    });

    return res.data.values;
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
});

ipcMain.handle('submit-reservation', async (event, payload) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    const newRow = [
      "예약확정",
      payload.name,
      payload.id,
      payload.time,
      generateCode(),
      "",
      payload.date,
      payload.time,
      payload.date,
      calculateEndTime(payload.time),
      payload.note
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: config.SHEET_ID_LOG,
      range: 'ResponseTable',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [newRow] },
    });

    return newRow[4];
  } catch (error) {
    console.error('예약 등록 오류:', error);
    throw error;
  }
});

ipcMain.handle('submit-cancellation', async (event, payload) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SHEET_ID_LOG,
      range: 'ResponseTable',
    });

    const rows = res.data.values;
    const codeColIndex = 4;
    const rowIndex = rows.findIndex(row => row[codeColIndex] === payload.code);
    if (rowIndex === -1) throw new Error('해당 승인번호를 찾을 수 없습니다.');

    rows[rowIndex][0] = "예약취소";
    rows[rowIndex][5] = payload.reason;

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.SHEET_ID_LOG,
      range: `ResponseTable!A${rowIndex + 1}:L${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [rows[rowIndex]] },
    });

    return '취소 처리 완료';
  } catch (error) {
    console.error('예약 취소 오류:', error);
    throw error;
  }
});

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function calculateEndTime(startTime) {
  const [h, m] = startTime.split(":").map(Number);
  const end = new Date();
  end.setHours(h + 3);
  end.setMinutes(m);
  return end.toTimeString().substring(0, 5);
}

async function logUserToMonthlySpreadsheet(auth, userInfo) {
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const fileName = `log_${month}_${year}`;

  // automatic -> log file
  const fileListRes = await drive.files.list({
    q: `name='${fileName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive'
  });

  let fileId;
  let isNewFile = false;

  if (fileListRes.data.files.length > 0) {
    fileId = fileListRes.data.files[0].id;
  } else {
    const createRes = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'application/vnd.google-apps.spreadsheet'
      },
      fields: 'id'
    });
    fileId = createRes.data.id;
    isNewFile = true;
    
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: userInfo.email
      },
      fields: 'id'
    });
  }

  const dataRow = [[
    now.toISOString().split('T')[0],
    userInfo.sub,
    userInfo.name,
    userInfo.email,
    userInfo.email_verified,
    userInfo.locale,
    formatKST(now)
  ]];

  const values = isNewFile
    ? [["날짜", "사용자 ID", "이름", "이메일", "인증됨", "언어", "로그인 시각"], ...dataRow]
    : dataRow;

  await sheets.spreadsheets.values.append({
    spreadsheetId: fileId,
    range: 'A1',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values }
  });

  console.log(`✅ 사용자 로그인 정보가 ${fileName}에 저장되었습니다.`);
}

function formatKST(datetime = new Date()) {
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(datetime.getTime() + kstOffset);
  return kst.toISOString().replace('T', ' ').substring(0, 19);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on('send-access-request', async (event, { name, id, note, email }) => {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const message = [
    'From: me',
    'To: admin@example', // your e-mail
    'Subject: [QuantStudio] New Access Request',
    '',
    `이름: ${name}`,
    `학번/사번: ${id}`,
    `이메일: ${email}`,
    `기타사항: ${note || '-'}`,
  ].join('\n');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: Buffer.from(message).toString('base64url') }
  });

  console.log(`📧 접근 요청 메일 전송됨: ${email}`);
});

async function getWhitelist(auth) {
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.SHEET_ID_WHITELIST,
    range: 'Whitelist!A:A',        
  });

  const values = res.data.values || [];
  return values.map(row => row[0]); 
}