import { useLanguage } from "../context/Language";
import { t, getLocale } from "../domain/language";
import { useLocation } from "react-router-dom";
import LanguageSelect from "../context/Language";
const titles = {
  "/admin": ["Overview", "Your event operation at a glance"],
  "/admin/calendar": ["Calendar", "Equipment availability across every event"],
  "/admin/rentals": ["Events", "Create and manage equipment rentals"],
  "/admin/reports": ["Reports", "Monthly financial and operational summary"],
  "/admin/team": ["Team", "People and availability"],
  "/admin/equipment": ["Equipment", "Inventory and rental rates"]
};
export default function Navbar({
  onMenu
}) {
  useLanguage();
  const location = useLocation();
  const [title, subtitle] = titles[location.pathname] ?? titles["/admin"];
  return <header className="topbar">
      <button className="menu-button" onClick={onMenu} aria-label={t("Open navigation")}>☰</button>
      <div>
        <h1>{t(title)}</h1>
        <p>{t(subtitle)}</p>
      </div>
      <LanguageSelect />
      <div className="topbar-date">
        <span>{t("Today")}</span>
        <strong>{new Intl.DateTimeFormat(getLocale(), {
          day: "2-digit",
          month: "short"
        }).format(new Date())}</strong>
      </div>
    </header>;
}
