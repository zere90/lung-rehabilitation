const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
const { User, LessonProgress, TestResult, Certificate } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ ПОДКЛЮЧЕНИЕ К MONGODB ============
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lung-rehab';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB подключена успешно'))
  .catch(err => console.error('❌ Ошибка подключения к MongoDB:', err));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'lung-rehab-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    touchAfter: 24 * 3600 // Обновлять сессию раз в 24 часа
  }),
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, // 24 часа
    secure: process.env.NODE_ENV === 'production' // HTTPS в продакшене
  }
}));

// Создание папки для сертификатов
if (!fs.existsSync('./certificates')) {
  fs.mkdirSync('./certificates');
}

// Middleware для проверки авторизации
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Необходима авторизация' });
  }
}

// ============ РЕГИСТРАЦИЯ ============
app.post('/api/register', async (req, res) => {
  const { username, email, password, full_name } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      username,
      email,
      password: hashedPassword,
      full_name
    });

    await user.save();

    // Инициализация прогресса для всех уроков
    const progressPromises = [];
    for (let i = 1; i <= 7; i++) {
      progressPromises.push(
        new LessonProgress({
          user_id: user._id,
          lesson_number: i
        }).save()
      );
    }
    await Promise.all(progressPromises);

    res.json({ success: true, message: 'Регистрация успешна' });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Пользователь с таким email или логином уже существует' });
    } else {
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
});

// ============ ВХОД ============
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    req.session.userId = user._id.toString();
    req.session.username = user.username;
    
    res.json({ 
      success: true, 
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email,
        full_name: user.full_name
      } 
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============ ВЫХОД ============
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ============ ПОЛУЧИТЬ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ============
app.get('/api/user', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============ ОТМЕТИТЬ УРОК КАК ПРОЙДЕННЫЙ ============
app.post('/api/lesson/complete', isAuthenticated, async (req, res) => {
  const { lesson_number } = req.body;
  
  try {
    await LessonProgress.updateOne(
      { user_id: req.session.userId, lesson_number },
      { 
        completed: true, 
        completed_at: new Date() 
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка обновления прогресса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============ ПОЛУЧИТЬ ПРОГРЕСС ПОЛЬЗОВАТЕЛЯ ============
app.get('/api/progress', isAuthenticated, async (req, res) => {
  try {
    const progress = await LessonProgress.find({ user_id: req.session.userId })
      .sort({ lesson_number: 1 })
      .select('lesson_number completed completed_at');
    
    res.json(progress);
  } catch (error) {
    console.error('Ошибка получения прогресса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============ СОХРАНИТЬ РЕЗУЛЬТАТ ТЕСТА ============
app.post('/api/test/submit', isAuthenticated, async (req, res) => {
  const { score, total_questions, answers } = req.body;
  const passed = score >= 5;
  
  try {
    const testResult = new TestResult({
      user_id: req.session.userId,
      score,
      total_questions,
      answers: JSON.stringify(answers),
      passed
    });

    await testResult.save();
    
    res.json({ success: true, passed });
  } catch (error) {
    console.error('Ошибка сохранения теста:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============ ПОЛУЧИТЬ РЕЗУЛЬТАТЫ ТЕСТОВ ============
app.get('/api/test/results', isAuthenticated, async (req, res) => {
  try {
    const results = await TestResult.find({ user_id: req.session.userId })
      .sort({ taken_at: -1 })
      .select('score total_questions passed taken_at');
    
    res.json({ results });
  } catch (error) {
    console.error('Ошибка получения результатов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============ ГЕНЕРАЦИЯ СЕРТИФИКАТА ============
app.post('/api/certificate/generate', isAuthenticated, async (req, res) => {
  try {
    // Проверка условий для получения сертификата
    const completedLessons = await LessonProgress.countDocuments({
      user_id: req.session.userId,
      completed: true
    });

    const passedTest = await TestResult.findOne({
      user_id: req.session.userId,
      passed: true
    }).sort({ taken_at: -1 });

    if (completedLessons < 7 || !passedTest) {
      return res.status(400).json({ 
        error: 'Необходимо пройти все уроки и тест с результатом не менее 5/7' 
      });
    }

    // Проверка существующего сертификата
    let existingCert = await Certificate.findOne({ user_id: req.session.userId });

    if (existingCert) {
      return res.json({ 
        success: true, 
        certificate_number: existingCert.certificate_number,
        pdf_path: existingCert.pdf_path
      });
    }

    // Генерация номера сертификата
    const certificateNumber = `CERT-${Date.now()}-${req.session.userId}`;
    
    // Получение данных пользователя
    const user = await User.findById(req.session.userId);
    
    // Генерация PDF сертификата
    const pdfPath = await generateCertificatePDF(user, certificateNumber);

    // Сохранение в базу данных
    const certificate = new Certificate({
      user_id: req.session.userId,
      certificate_number: certificateNumber,
      pdf_path: pdfPath
    });

    await certificate.save();

    res.json({ 
      success: true, 
      certificate_number: certificateNumber,
      pdf_path: pdfPath
    });

  } catch (error) {
    console.error('Ошибка генерации сертификата:', error);
    res.status(500).json({ error: 'Ошибка генерации сертификата' });
  }
});

// ============ СКАЧАТЬ СЕРТИФИКАТ ============
app.get('/api/certificate/download', isAuthenticated, async (req, res) => {
  try {
    const cert = await Certificate.findOne({ user_id: req.session.userId });

    if (!cert) {
      return res.status(404).json({ error: 'Сертификат не найден' });
    }

    // Получаем данные пользователя для имени файла
    const user = await User.findById(req.session.userId).select('full_name username');
    
    const userName = user.full_name || user.username;
    const fileName = `Сертификат_${userName.replace(/\s+/g, '_')}.pdf`;

    // Устанавливаем заголовки для принудительного скачивания
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Отправляем файл
    res.sendFile(path.resolve(cert.pdf_path));
  } catch (error) {
    console.error('Ошибка скачивания сертификата:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============ ФУНКЦИЯ ГЕНЕРАЦИИ PDF СЕРТИФИКАТА ============
async function generateCertificatePDF(user, certificateNumber) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page { size: A4 landscape; margin: 0; }
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 60px;
          background: linear-gradient(135deg, #E3F2FD 0%, #ffffff 100%);
        }
        .certificate {
          background: white;
          padding: 80px;
          border: 15px solid #1E88E5;
          border-radius: 30px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          max-width: 900px;
          margin: auto;
        }
        h1 {
          color: #0D47A1;
          font-size: 48px;
          margin-bottom: 20px;
          letter-spacing: 3px;
        }
        .subtitle {
          font-size: 20px;
          color: #555;
          margin-bottom: 40px;
        }
        .recipient-name {
          font-size: 42px;
          font-weight: bold;
          color: #1E88E5;
          margin: 40px 0;
          border-bottom: 3px solid #1E88E5;
          padding-bottom: 20px;
        }
        .description {
          font-size: 18px;
          color: #333;
          line-height: 1.8;
          margin: 30px 0;
        }
        .footer {
          margin-top: 60px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .date {
          font-size: 16px;
          color: #666;
        }
        .cert-number {
          font-size: 14px;
          color: #999;
        }
        .signatures {
          margin-top: 50px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          text-align: center;
        }
        .signature-line {
          border-top: 2px solid #0D47A1;
          padding-top: 10px;
          margin-top: 60px;
        }
        .signature-title {
          font-size: 14px;
          color: #666;
          margin-top: 5px;
        }
      </style>
    </head>
    <body>
      <div class="certificate">
        <h1>СЕРТИФИКАТ</h1>
        <p class="subtitle">об успешном завершении образовательной программы</p>
        
        <div class="recipient-name">${user.full_name || user.username}</div>
        
        <p class="description">
          Подтверждает, что вышеназванное лицо успешно прошло образовательную программу<br>
          <strong>«Реабилитация после лечения рака лёгких»</strong><br>
          включающую 7 учебных модулей и итоговую аттестацию
        </p>

        <div class="signatures">
          <div>
            <div class="signature-line">
              <strong>Әділғазыұлы Шыңғыс</strong>
              <div class="signature-title">Врач онколог-хирург, магистр медицины, PhD докторант</div>
            </div>
          </div>
          <div>
            <div class="signature-line">
              <strong>Адылханов Т.А.</strong>
              <div class="signature-title">Доктор медицинских наук, профессор, главный консультант по онкологии ННOЦ</div>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <div class="date">Дата выдачи: ${new Date().toLocaleDateString('ru-RU')}</div>
          <div class="cert-number">№ ${certificateNumber}</div>
        </div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  
  const pdfPath = `./certificates/${certificateNumber}.pdf`;
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });

  await browser.close();
  
  return pdfPath;
}

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});

module.exports = app;
