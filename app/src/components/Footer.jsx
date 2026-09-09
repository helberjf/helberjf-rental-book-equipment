import { useLanguage } from "../context/Language";
import { t } from "../domain/language";
export default function Footer() {
  useLanguage();
  return <footer className="footer">
      <span>Rental Book · <a href="https://www.linkedin.com/in/helber-soares/" target="_blank" rel="noopener noreferrer">{t('Developed by Helber Soares')}</a></span>
      <span>{t("Times shown in Brazil time")}</span>
    </footer>;
}
