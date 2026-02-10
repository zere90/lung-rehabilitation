function toggleMenu() {
  const mobileNav = document.getElementById('mobileNav');
  mobileNav.classList.toggle('active');
}

// Закрытие меню при клике вне его
document.addEventListener('click', function(event) {
  const burger = document.querySelector('.burger');
  const mobileNav = document.getElementById('mobileNav');
  
  if (burger && mobileNav) {
    const isClickInsideMenu = mobileNav.contains(event.target);
    const isClickOnBurger = burger.contains(event.target);
    
    if (!isClickInsideMenu && !isClickOnBurger && mobileNav.classList.contains('active')) {
      mobileNav.classList.remove('active');
    }
  }
});
