const mongoose = require('mongoose');

// ============ СХЕМА ПОЛЬЗОВАТЕЛЯ ============
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  full_name: {
    type: String,
    trim: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// ============ СХЕМА ПРОГРЕССА УРОКОВ ============
const lessonProgressSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lesson_number: {
    type: Number,
    required: true,
    min: 1,
    max: 7
  },
  completed: {
    type: Boolean,
    default: false
  },
  completed_at: {
    type: Date
  }
});

// Уникальный индекс для пары user_id + lesson_number
lessonProgressSchema.index({ user_id: 1, lesson_number: 1 }, { unique: true });

// ============ СХЕМА РЕЗУЛЬТАТОВ ТЕСТОВ ============
const testResultSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 7
  },
  total_questions: {
    type: Number,
    required: true,
    default: 7
  },
  answers: {
    type: String // JSON строка с ответами
  },
  passed: {
    type: Boolean,
    default: false
  },
  taken_at: {
    type: Date,
    default: Date.now
  }
});

// ============ СХЕМА СЕРТИФИКАТОВ ============
const certificateSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // Один сертификат на пользователя
  },
  certificate_number: {
    type: String,
    required: true,
    unique: true
  },
  issued_at: {
    type: Date,
    default: Date.now
  },
  pdf_path: {
    type: String
  }
});

// Создание моделей
const User = mongoose.model('User', userSchema);
const LessonProgress = mongoose.model('LessonProgress', lessonProgressSchema);
const TestResult = mongoose.model('TestResult', testResultSchema);
const Certificate = mongoose.model('Certificate', certificateSchema);

module.exports = {
  User,
  LessonProgress,
  TestResult,
  Certificate
};
