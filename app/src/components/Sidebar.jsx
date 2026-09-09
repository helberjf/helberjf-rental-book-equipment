import { useLanguage } from "../context/Language";
import { t } from "../domain/language";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
const items = [{
  to: "/admin",
  end: true,
  icon: "◫",
  label: "Overview"
}, {
  to: "/admin/calendar",
  icon: "▦",
  label: "Calendar"
}, {
  to: "/admin/rentals",
  icon: "◇",
  label: "Events"
}, {
  to: "/admin/reports",
  icon: "↗",
  label: "Reports"
}, {
  to: "/admin/team",
  icon: "♧",
  label: "Team"
}, {
  to: "/admin/equipment",
  icon: "▣",
  label: "Equipment"
}];
export default function Sidebar({
  open,
  onClose
}) {
  useLanguage();
  const {
    user,
    signOut
  } = useAuth();
  return <aside className={`sidebar ${open ? "is-open" : ""}`}>
      <div className="brand">
        <div className="brand-mark">RB</div>
        <div>
          <strong>Rental Book</strong>
          <span>{t("Event equipment")}</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label={t("Main navigation")}>
        <span className="nav-caption">{t("Workspace")}</span>
        {items.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={onClose} className={({
        isActive
      }) => `sidebar-link ${isActive ? "active" : ""}`}>
            <span className="sidebar-icon" aria-hidden="true">{item.icon}</span>
            {t(item.label)}
          </NavLink>)}
      </nav>

      <div className="inventory-note">
        <span className="inventory-dot" />
        <div>
          <strong>Rental Book</strong>
          <small>{t("Event equipment")}</small>
        </div>
      </div>
      <div className="sidebar-user">
        <div><strong>{user?.name}</strong><small>{t(user?.role)}</small></div>
        <button onClick={signOut} title={t("Sign out")} aria-label={t("Sign out")}>↪</button>
      </div>
    </aside>;
}
