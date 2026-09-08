import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";
import BaseLayout from "./layouts/BaseLayout";
import AuthGuard from "./components/AuthGuard";
import { AuthProvider } from "./context/AuthContext";
import Calendar from "./pages/Calendar";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Rentals from "./pages/Rentals";
import Reports from "./pages/Reports";
import Signin from "./pages/Signin";
import "./App.css";

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/login", element: <Signin /> },
  {
    path: "/admin",
    element: <AuthGuard><BaseLayout /></AuthGuard>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "calendar", element: <Calendar /> },
      { path: "rentals", element: <Rentals /> },
      { path: "reports", element: <Reports /> },
    ],
  },
  { path: "/dashboard", element: <Navigate to="/admin" replace /> },
  { path: "/rentals", element: <Navigate to="/admin/rentals" replace /> },
  { path: "/reports", element: <Navigate to="/admin/reports" replace /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return <AuthProvider><RouterProvider router={router} /></AuthProvider>;
}
