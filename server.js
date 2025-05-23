require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const multer = require('multer');
const fs = require('fs');
const speech = require('@google-cloud/speech');

const app = express();
const upload = multer({ dest: 'uploads/' });

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('エラー: GOOGLE_APPLICATION_CREDENTIALS が設定されていません！');
  process.exit(1);
}

const client = new speech.SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

app.use(bodyParser.json());
app.use(express.static('public'));

app.use(cors({
  origin: 'https://gms.gdl.jp',
  credentials: true
}));

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore({ checkPeriod: 86400000 }),
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 30 * 60 * 1000
  }
}));

const users = [
  { username: '2024winter', password: 'pass' }
];

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'ユーザー名とパスワードは必須です。' });
  }

  if (users.find(u => u.username === username)) {
    return res.status(409).json({ success: false, message: 'このユーザー名は既に使用されています。' });
  }

  users.push({ username, password });
  res.json({ success: true, message: 'ユーザー登録が完了しました。' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    req.session.user = user;
    res.json({ success: true, username: user.username });
  } else {
    res.status(401).json({ success: false, message: 'ユーザー名またはパスワードが間違っています' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'ログアウトに失敗しました' });
    }
    res.json({ success: true });
  });
});

app.get('/check-session', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, username: req.session.user.username });
  } else {
    res.json({ loggedIn: false });
  }
});

app.post('/upload', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ファイルがアップロードされていません。' });
  }

  const filePath = req.file.path;

  try {
    const audioBytes = fs.readFileSync(filePath).toString('base64');

    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: 'WEBM_OPUS', 
        sampleRateHertz: 48000, 
        languageCode: 'ja-JP',
        alternativeLanguageCodes: ['en-US']
      },
    };

    const [response] = await client.recognize(request);
    const transcription = response.results
      .map((result) => result.alternatives[0].transcript)
      .join('\n');

    res.json({ transcription: transcription || '文字起こし結果がありません' });
  } catch (error) {
    console.error('エラー詳細:', error.message, error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  } finally {
    fs.unlinkSync(filePath);
  }
});

// **サーバー起動**
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
