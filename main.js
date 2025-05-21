const { app, BrowserWindow, ipcMain, session, Menu } = require('electron');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

function loadEncryptedConfig() {
    const data = fs.readFileSync(path.join(__dirname, 'configFile.enc'));
    
    // WARNING: The decryption key is intentionally left blank for public distribution.
    // To run this application, you must provide the correct key securely in your environment.    
    const key = crypto.createHash('sha256').update('yourkey').digest();
    const iv = data.slice(0, 16);
    const encrypted = data.slice(16);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    
    return JSON.parse(decrypted.toString());
}

//NEW ACCOUNT SERVICE
function loadServiceKey() {
  const data = fs.readFileSync(path.join(__dirname, 'serviceKey.enc'));
  const key = crypto.createHash('sha256').update('your code').digest();
  const iv = data.slice(0, 16);
  const encrypted = data.slice(16);

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return JSON.parse(decrypted.toString());
}

const serviceKey = loadServiceKey();
const serviceAuth = new google.auth.GoogleAuth({
  credentials: serviceKey,
  scopes: ['https://www.googleapis.com/auth/drive.file']
});

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
  
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const { shell } = require('electron');
    shell.openExternal(url);
    return { action: 'deny' };
  });  
  
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
    } catch (err) {}
  }
  return null;
}

ipcMain.handle('toggle-google-login', async () => {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH);
      await session.defaultSession.clearStorageData();

      const logoutWin = new BrowserWindow({ show: false });
      logoutWin.loadURL('https://accounts.google.com/Logout');

      setTimeout(() => {
        if (!logoutWin.isDestroyed()) logoutWin.close();
      }, 1500);

      return { status: 'loggedOut' };
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    const authWin = new BrowserWindow({
      width: 500,
      height: 600,
      modal: true,
      show: true,
      frame: true,
      titleBarStyle: "default",
      title: "Login",
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
          const userEmail = userInfo.data.email;

          await uploadUserInfoToDrive(oauth2Client, userInfo.data);

          const whitelist = await getWhitelist(oauth2Client);

          if (!whitelist.includes(userEmail)) {
            authWin.close();
            return resolve({ status: 'notAllowed', user: userInfo.data });
          }

          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
          authWin.close();

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('login-complete', userInfo.data);
          }

          resolve({ status: 'loggedIn', user: userInfo.data });
        } catch (err) {
          if (!authWin.isDestroyed()) authWin.close();
          reject(err);
        }
      });

      setTimeout(() => {
        if (!authWin.isDestroyed()) authWin.close();
        reject(new Error('로그인 시간이 초과되었습니다.'));
      }, 90 * 1000);
    });
  } catch (err) {
    throw new Error('예기치 않은 오류 발생');
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

function sanitizeFilename(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '_');
}

function getCompactTimestampKST(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000); // UTC+9
  const yyyy = kst.getFullYear();
  const MM = String(kst.getMonth() + 1).padStart(2, '0');
  const dd = String(kst.getDate()).padStart(2, '0');
  const hh = String(kst.getHours()).padStart(2, '0');
  const mm = String(kst.getMinutes()).padStart(2, '0');
  return `${yyyy}${MM}${dd}${hh}${mm}`;
}

// Changed logic
async function uploadUserInfoToDrive(_unusedAuth, userInfo) {
  const authClient = await serviceAuth.getClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  const safeRawName = userInfo.name || userInfo.email.split('@')[0] || 'unknown';
  const safeName = sanitizeFilename(safeRawName);
  const timestamp = getCompactTimestampKST();
  const filename = `${safeName}_${timestamp}.json`;
  const tempPath = path.join(app.getPath('userData'), filename);

  const cleanedUserInfo = {
    id: userInfo.id,
    email: userInfo.email,
    verified_email: userInfo.verified_email,
    name: userInfo.name,
    locale: userInfo.locale,
    login_time: formatKST()
  };

  fs.writeFileSync(tempPath, JSON.stringify(cleanedUserInfo, null, 2));

  const fileMetadata = {
    name: filename,
    parents: ['your_data_server'], 
  };
  const media = {
    mimeType: 'application/json',
    body: fs.createReadStream(tempPath),
  };

  await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id'
  });

  fs.unlinkSync(tempPath);
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