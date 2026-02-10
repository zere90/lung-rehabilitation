// Проверка авторизации на странице
function checkAuth() {
  const publicPages = ['auth.html', 'index.html'];
  const currentPage = window.location.pathname.split('/').pop();
  
  // Публичные страницы доступны без авторизации
  if (publicPages.includes(currentPage)) {
    return;
  }
  
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'auth.html';
  }
}

// Получить текущего пользователя из localStorage
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

// Обновление навигации (ИСПРАВЛЕНО - БЕЗ ДУБЛИРОВАНИЯ!)
function updateNavigation() {
  const user = getCurrentUser();
  if (!user) return;

  const desktopNav = document.querySelector('.nav');
  const mobileNav = document.querySelector('.mobile-nav');

  // КРИТИЧЕСКИ ВАЖНО: Проверяем не добавили ли уже элементы
  if (desktopNav && desktopNav.querySelector('.user-info')) {
    console.log('⚠️ Навигация уже обновлена, пропускаем дублирование');
    return; // Выходим, чтобы не добавлять повторно
  }

  console.log('✅ Обновляем навигацию для пользователя:', user.full_name || user.username);

  // Создаём ссылку на имя пользователя - ПОКАЗЫВАЕМ FULL_NAME!
  const userNameLink = document.createElement('a');
  userNameLink.href = 'profile.html';
  userNameLink.style.fontWeight = '600';
  userNameLink.style.color = 'var(--primary)';
  userNameLink.textContent = user.full_name || user.username; // ПОКАЗЫВАЕМ ИМЯ ФАМИЛИЮ!
  userNameLink.className = 'user-info'; // Маркер для проверки

  // Создаём кнопку выхода
  const logoutLink = document.createElement('a');
  logoutLink.href = '#';
  logoutLink.textContent = 'Выход';
  logoutLink.className = 'user-info'; // Маркер для проверки
  logoutLink.onclick = async (e) => {
    e.preventDefault();
    await logout();
  };

  // Добавляем в десктопную навигацию
  if (desktopNav) {
    desktopNav.appendChild(userNameLink.cloneNode(true));
    desktopNav.appendChild(logoutLink.cloneNode(true));
  }

  // Добавляем в мобильную навигацию
  if (mobileNav) {
    mobileNav.appendChild(userNameLink.cloneNode(true));
    mobileNav.appendChild(logoutLink.cloneNode(true));
  }
}

// Функция выхода
async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('user');
    window.location.href = 'auth.html';
  } catch (error) {
    console.error('Ошибка выхода:', error);
    // Всё равно выходим локально
    localStorage.removeItem('user');
    window.location.href = 'auth.html';
  }
}
