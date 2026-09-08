import { NavLink } from "react-router-dom";

const items = [
  { to: "/admin", end: true, icon: "◫", label: "Overview" },
  { to: "/admin/calendar", icon: "▦", label: "Calendar" },
  { to: "/admin/rentals", icon: "◇", label: "Events" },
  { to: "/admin/reports", icon: "↗", label: "Reports" },
];

export default function Sidebar({ open, onClose }) {
  return (
    <aside className={`sidebar ${open ? "is-open" : ""}`}>
      <div className="brand">
        <div className="brand-mark">RB</div>
        <div>
          <strong>Rental Book</strong>
          <span>Event equipment</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <span className="nav-caption">Workspace</span>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
          >
            <span className="sidebar-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="inventory-note">
        <span className="inventory-dot" />
        <div>
          <strong>9 tracked units</strong>
          <small>8 LED robots · 1 LED swing</small>
        </div>
      </div>
    </aside>
  );
}
