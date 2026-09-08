import MyModal from "../components/MyModal";
import { useState, useEffect, useCallback } from "react";
import { showSuccess, showError, showConfirm } from "../utils/alert.utils";
import api from "../services/axios";

const DEPOSIT_STATUS_COLOR = {
  HELD: "warning",
  REFUNDED: "success",
  DEDUCTED: "danger",
};

export default function Deposits() {
  // =========================
  // LIST STATE
  // =========================
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // =========================
  // DETAIL MODAL
  // =========================
  const [detail, setDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [depRefundAmt, setDepRefundAmt] = useState("");
  const [depRefunding, setDepRefunding] = useState(false);
  const [depDeductAmt, setDepDeductAmt] = useState("");
  const [depDeducting, setDepDeducting] = useState(false);
  const [depUpdateAmt, setDepUpdateAmt] = useState("");
  const [depUpdating, setDepUpdating] = useState(false);

  // =========================
  // FETCH
  // =========================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/admin/deposits", {
        params: {
          page,
          limit,
          status: statusFilter || undefined,
        },
      });
      setData(res.data.result.deposits || []);
      setTotal(res.data.result.total || 0);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // =========================
  // OPEN DETAIL
  // =========================
  const openDetail = async (item) => {
    try {
      const res = await api.get(`/api/rentals/${item.rentalId}`);
      setDetail({ ...item, rental: res.data.result });
      setDepRefundAmt("");
      setDepDeductAmt("");
      setDepUpdateAmt(item.amount);
      setDetailOpen(true);
    } catch (e) {
      showError(e);
    }
  };

  const refreshDetail = async () => {
    if (!detail) return;
    try {
      const [depRes, rentalRes] = await Promise.all([
        api.get(`/api/rentals/${detail.rentalId}/deposit`),
        api.get(`/api/rentals/${detail.rentalId}`),
      ]);
      setDetail({ ...depRes.data.result, rental: rentalRes.data.result });
      fetchData();
    } catch (e) {
      showError(e);
    }
  };

  // =========================
  // ACTIONS
  // =========================
  const handleUpdate = async () => {
    if (depUpdating) return;
    if (!depUpdateAmt) return showError("Please provide");
    const ok = await showConfirm("Update Deposit?", `Update${depUpdateAmt}?`, "Confirm", "Cancel");
    if (!ok) return;
    try {
      setDepUpdating(true);
      await api.patch(`/api/rentals/${detail.rentalId}/deposit`, {
        amount: Number(depUpdateAmt),
      });
      showSuccess("Update Deposit Success");
      await refreshDetail();
    } catch (e) {
      showError(e);
    } finally {
      setDepUpdating(false);
    }
  };

  const handleRefund = async () => {
    if (depRefunding) return;
    if (!depRefundAmt) return showError("Please provide");
    const ok = await showConfirm("Refund deposit?", `Deposit${depRefundAmt}?`, "Confirm", "Cancel");
    if (!ok) return;
    try {
      setDepRefunding(true);
      await api.patch(`/api/rentals/${detail.rentalId}/deposit/refund`, {
        refundedAmount: Number(depRefundAmt),
      });
      showSuccess("Operation completed successfully");
      setDepRefundAmt("");
      await refreshDetail();
    } catch (e) {
      showError(e);
    } finally {
      setDepRefunding(false);
    }
  };

  const handleDeduct = async () => {
    if (depDeducting) return;
    if (!depDeductAmt) return showError("Please provide");
    const ok = await showConfirm("Deduct deposit?", `$${depDeductAmt} Deposit?`, "Confirm", "Cancel");
    if (!ok) return;
    try {
      setDepDeducting(true);
      await api.patch(`/api/rentals/${detail.rentalId}/deposit/deduct`, {
        amount: Number(depDeductAmt),
      });
      showSuccess("Operation completed successfully");
      setDepDeductAmt("");
      await refreshDetail();
    } catch (e) {
      showError(e);
    } finally {
      setDepDeducting(false);
    }
  };

  return (
    <>
      <div className="card mt-3 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Manage deposits</span>
          {loading && <div className="spinner-border spinner-border-sm text-secondary" />}
        </div>

        <div className="card-body">
          {/* FILTER */}
          <div className="row mb-3 g-2">
            <div className="col-md-3">
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="">Status</option>
                <option value="HELD">HELD (Held)</option>
                <option value="REFUNDED">REFUNDED (Returned)</option>
                <option value="DEDUCTED">DEDUCTED (Deducted)</option>
              </select>
            </div>
          </div>

          {/* TABLE */}
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Rental Code</th>
                  <th>Customer</th>
                  <th>Deposit</th>
                  <th>Returned</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th width="80" className="text-center">Manage</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="text-center text-muted">Loading...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan="8" className="text-center text-muted">No data</td></tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td><code>{item.rental?.code || `Rental #${item.rentalId}`}</code></td>
                      <td>{item.rental?.user?.name || "-"}</td>
                      <td>${item.amount?.toLocaleString()}</td>
                      <td>${(item.refundedAmount || 0).toLocaleString()}</td>
                      <td>
                        <span className={`badge bg-${DEPOSIT_STATUS_COLOR[item.status] || "secondary"}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>{new Date(item.createdAt).toLocaleDateString("th-TH")}</td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => openDetail(item)}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="mt-3 d-flex justify-content-center align-items-center">
            <button className="btn btn-outline-secondary me-2" disabled={page === 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span>Page {page} / {totalPages}</span>
            <button className="btn btn-outline-secondary ms-2" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      <MyModal
        id="modalDepositDetail"
        title={`Deposit — ${detail?.rental?.code || ""}`}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        {detail && (
          <>
            {/* SUMMARY CARD */}
            <div className="row g-2 text-center mb-3">
              <div className="col-4">
                <div className="border rounded p-2">
                  <small className="text-muted d-block">Deposit</small>
                  <strong className="fs-5">${detail.amount?.toLocaleString()}</strong>
                </div>
              </div>
              <div className="col-4">
                <div className="border rounded p-2">
                  <small className="text-muted d-block">Returned</small>
                  <strong className="fs-5 text-success">${(detail.refundedAmount || 0).toLocaleString()}</strong>
                </div>
              </div>
              <div className="col-4">
                <div className="border rounded p-2">
                  <small className="text-muted d-block">Status</small>
                  <span className={`badge fs-6 bg-${DEPOSIT_STATUS_COLOR[detail.status] || "secondary"}`}>
                    {detail.status}
                  </span>
                </div>
              </div>
            </div>

            {/* RENTAL INFO */}
            {detail.rental && (
              <div className="alert alert-light border py-2 mb-3 small">
                <div className="row g-1">
                  <div className="col-6">
                    <span className="text-muted">Customer: </span>
                    <strong>{detail.rental.user?.name}</strong>
                  </div>
                  <div className="col-6">
                    <span className="text-muted">Rental: </span>
                    <span className="badge bg-secondary">{detail.rental.status}</span>
                  </div>
                  <div className="col-6">
                    <span className="text-muted">Pickup date: </span>
                    {new Date(detail.rental.startDate).toLocaleDateString("th-TH")}
                  </div>
                  <div className="col-6">
                    <span className="text-muted">Return date: </span>
                    {new Date(detail.rental.endDate).toLocaleDateString("th-TH")}
                  </div>
                </div>
              </div>
            )}

            {detail.status === "HELD" ? (
              <>
                {/* UPDATE AMOUNT */}
                <div className="border rounded p-3 bg-light mb-3">
                  <small className="text-muted fw-bold d-block mb-2">Edit</small>
                  <div className="d-flex gap-2">
                    <input
                      type="number"
                      className="form-control"
                      value={depUpdateAmt}
                      onChange={(e) => setDepUpdateAmt(e.target.value)}
                      disabled={depUpdating}
                    />
                    <button className="btn btn-outline-primary" onClick={handleUpdate} disabled={depUpdating}>
                      {depUpdating ? <span className="spinner-border spinner-border-sm" /> : "Update"}
                    </button>
                  </div>
                </div>

                {/* REFUND + DEDUCT */}
                <div className="row g-3">
                  <div className="col-6">
                    <div className="border rounded p-3 bg-light h-100">
                      <small className="text-muted fw-bold d-block mb-2">Refund deposit</small>
                      <input
                        type="number"
                        className="form-control form-control-sm mb-2"
                        placeholder={`$${detail.amount?.toLocaleString()}`}
                        value={depRefundAmt}
                        onChange={(e) => setDepRefundAmt(e.target.value)}
                        disabled={depRefunding}
                      />
                      <button className="btn btn-success btn-sm w-100" onClick={handleRefund} disabled={depRefunding}>
                        {depRefunding ? <span className="spinner-border spinner-border-sm" /> : "Refund deposit"}
                      </button>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="border rounded p-3 bg-light h-100">
                      <small className="text-muted fw-bold d-block mb-2">Deduct deposit</small>
                      <input
                        type="number"
                        className="form-control form-control-sm mb-2"
                        placeholder={`$${detail.amount?.toLocaleString()}`}
                        value={depDeductAmt}
                        onChange={(e) => setDepDeductAmt(e.target.value)}
                        disabled={depDeducting}
                      />
                      <button className="btn btn-danger btn-sm w-100" onClick={handleDeduct} disabled={depDeducting}>
                        {depDeducting ? <span className="spinner-border spinner-border-sm" /> : "Deduct deposit"}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="alert alert-secondary py-2 small mb-0">
                Deposit Details ({detail.status}) — This operation is not allowed
              </div>
            )}
          </>
        )}
      </MyModal>
    </>
  );
}

