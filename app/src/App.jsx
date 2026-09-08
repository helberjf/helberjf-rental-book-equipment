import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";
import BaseLayout from "./layouts/BaseLayout";
import Calendar from "./pages/Calendar";
import Dashboard from "./pages/Dashboard";
import Rentals from "./pages/Rentals";
import Reports from "./pages/Reports";
import "./App.css";

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/admin" replace /> },
  {
    path: "/admin",
    element: <BaseLayout />,
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
  { path: "*", element: <Navigate to="/admin" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
