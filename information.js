const pageTitles = {
  ja: 'サイト情報 — SONO',
  en: 'Site information — SONO',
  fr: 'Informations du site — SONO'
};
const pageDescriptions = {
  ja: 'SONOのサイト情報、プライバシーポリシー、予約・キャンセル方針、特定商取引法に基づく表示、写真クレジット。',
  en: 'SONO site information, privacy policy, booking and cancellation terms, commercial disclosure and photo credits.',
  fr: 'Informations sur SONO : confidentialité, réservation et annulation, mentions commerciales et crédits photo.'
};
function setInformationLanguage(language) {
  if (!Object.hasOwn(pageTitles, language)) language = 'ja';
  document.documentElement.lang = language;
  localStorage.setItem('tokyoSlowlyLanguage', language);
  document.title = pageTitles[language];
  document.querySelector('meta[name="description"]').content = pageDescriptions[language];
  document.querySelectorAll('.lang-button').forEach(button => {
    const active = button.dataset.lang === language;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
document.querySelectorAll('.lang-button').forEach(button => button.addEventListener('click', () => setInformationLanguage(button.dataset.lang)));
setInformationLanguage(localStorage.getItem('tokyoSlowlyLanguage') || 'ja');
