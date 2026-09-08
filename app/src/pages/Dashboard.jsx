import { useState, useEffect } from "react";
import { showError } from "../utils/alert.utils";
import api from "../services/axios";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await api.get("/api/admin/dashboard");
        setSummary(res.data.result.summary);
        setLowStock(res.data.result.lowStockVariants);
      } catch (e) {
        showError(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const statCards = [
    { label: "User", value: summary?.totalUsers, color: "primary" },
    { label: "Product Active", value: summary?.totalProducts, color: "success" },
    { label: "Rental", value: summary?.totalRentals, color: "info" },
    { label: "Rental", value: summary?.rentalsToday, color: "secondary" },
    { label: "Rental", value: summary?.rentalsThisMonth, color: "secondary" },
    { label: "Pending confirmation", value: summary?.pendingRentals, color: "warning" },
    { label: "Active rental", value: summary?.activeRentals, color: "success" },
    { label: "Overdue", value: summary?.lateRentals, color: "danger" },
    { label: "Payment slip", value: summary?.pendingPayments, color: "warning" },
    { label: "Details", value: summary ? `$${summary.revenueThisMonth.toLocaleString()}` : "-", color: "success" },
    { label: "Details", value: summary ? `$${summary.revenueTotal.toLocaleString()}` : "-", color: "primary" },
  ];

  return (
    <>
      <div className="card mt-3 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Dashboard</span>
          {loading && <div className="spinner-border spinner-border-sm text-secondary" />}
        </div>

        <div className="card-body">
          {/* STAT CARDS */}
          <div className="row g-3">
            {statCards.map((card, i) => (
              <div key={i} className="col-6 col-md-3">
                <div className={`card border-${card.color} shadow-sm h-100`}>
                  <div className="card-body text-center">
                    <div className={`h4 mb-1 text-${card.color}`}>
                      {loading ? <div className="spinner-border spinner-border-sm" /> : card.value}
                    </div>
                    <small className="text-muted">{card.label}</small>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* LOW STOCK */}
          <h6 className="text-danger mt-4 mb-2">⚠ Product Stock Details (Details 3)</h6>
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Product</th>
                  <th>Size</th>
                  <th>Color</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center text-muted">Loading...</td></tr>
                ) : lowStock.length === 0 ? (
                  <tr><td colSpan="4" className="text-center text-muted">Product stock Details</td></tr>
                ) : (
                  lowStock.map((v) => (
                    <tr key={v.id}>
                      <td>{v.product?.name}</td>
                      <td>{v.size?.name}</td>
                      <td>{v.color?.name}</td>
                      <td className="text-danger fw-bold">{v.stock}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}


