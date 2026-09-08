import { useLocation } from "react-router-dom";

const titles = {
  "/admin": ["Overview", "Your event operation at a glance"],
  "/admin/calendar": ["Calendar", "Equipment availability across every event"],
  "/admin/rentals": ["Events", "Create and manage equipment rentals"],
  "/admin/reports": ["Reports", "Monthly financial and operational summary"],
};

export default function Navbar({ onMenu }) {
  const location = useLocation();
  const [title, subtitle] = titles[location.pathname] ?? titles["/admin"];

  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenu} aria-label="Open navigation">☰</button>
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="topbar-date">
        <span>Today</span>
        <strong>{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date())}</strong>
      </div>
    </header>
  );
}
