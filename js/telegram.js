// ── TELEGRAM MINI APP ─────────────────────────────────────────────────────────
// Корректно деградирует когда запущен вне Telegram

const tg = window.Telegram?.WebApp;

export const TG = {
  isActive: !!tg,

  init() {
    if (!tg) return;
    tg.ready();
    tg.expand(); // на всю высоту
    tg.setHeaderColor('#03030A');
    tg.setBackgroundColor('#03030A');
    this.синхронизироватьТему();
  },

  синхронизироватьТему() {
    if (!tg) return;
    // Telegram передаёт CSS-переменные — адаптируем палитру если нужно
    const тема = tg.themeParams;
    if (тема?.bg_color) {
      document.documentElement.style.setProperty('--bg', тема.bg_color);
    }
  },

  hapticImpact(стиль = 'medium') {
    tg?.HapticFeedback?.impactOccurred(стиль);
  },

  hapticSuccess() {
    tg?.HapticFeedback?.notificationOccurred('success');
  },

  hapticError() {
    tg?.HapticFeedback?.notificationOccurred('error');
  },

  hapticSelection() {
    tg?.HapticFeedback?.selectionChanged();
  },

  showBackButton(обработчик) {
    if (!tg) return;
    tg.BackButton.show();
    tg.BackButton.onClick(обработчик);
  },

  hideBackButton() {
    if (!tg) return;
    tg.BackButton.hide();
    tg.BackButton.offClick();
  },

  setMainButton(текст, обработчик, цвет = '#00F5D4') {
    if (!tg) return;
    tg.MainButton.setText(текст);
    tg.MainButton.setParams({ color: цвет, text_color: '#000000' });
    tg.MainButton.onClick(обработчик);
    tg.MainButton.show();
  },

  hideMainButton() {
    if (!tg) return;
    tg.MainButton.hide();
    tg.MainButton.offClick();
  },

  getUserId() {
    return tg?.initDataUnsafe?.user?.id?.toString() || 'local';
  },

  getUserName() {
    const у = tg?.initDataUnsafe?.user;
    return у ? (у.first_name || у.username || '') : '';
  },
};
