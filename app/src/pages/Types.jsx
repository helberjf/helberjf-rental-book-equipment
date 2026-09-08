import MyModal from "../components/MyModal";
import { useState, useEffect, useCallback } from "react";
import { showSuccess, showError, showConfirm } from "../utils/alert.utils";
import api from "../services/axios";

export default function Types() {
  // =========================
  // LIST STATE
  // =========================
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // =========================
  // FORM STATE
  // =========================
  const [form, setForm] = useState({ id: null, name: "", categoryId: "" });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [open, setOpen] = useState(false);

  // =========================
  // CATEGORIES FOR SELECT
  // =========================
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api
      .get("/api/catalog/categories", { params: { limit: 100 } })
      .then((r) => setCategories(r.data.result.data))
      .catch(() => {});
  }, []);

  // =========================
  // DEBOUNCE SEARCH
  // =========================
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // =========================
  // FETCH
  // =========================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/catalog/types", {
        params: { page, limit, search: debouncedSearch },
      });
      setData(res.data.result.data);
      setTotal(res.data.result.total);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // =========================
  // FORM HANDLERS
  // =========================
  const clearForm = () => setForm({ id: null, name: "", categoryId: "" });

  const handleChange = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim() || !form.categoryId) return showError("Please fill in all required fields");

    try {
      setSaving(true);
      const payload = { name: form.name.trim(), categoryId: form.categoryId };
      if (!form.id) {
        await api.post("/api/catalog/types", payload);
        showSuccess("Operation completed successfully");
      } else {
        await api.put(`/api/catalog/types/${form.id}`, payload);
        showSuccess("Operation completed successfully");
      }
      clearForm();
      setOpen(false);
      fetchData();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setForm({ id: item.id, name: item.name, categoryId: item.categoryId });
    setOpen(true);
  };

  const handleRemove = async (item) => {
    if (removing) return;

    const confirmed = await showConfirm(
      "Confirm deletion?",
      `Do you want to delete "${item.name}" Details`,
      "Delete",
      "Cancel"
    );
    if (!confirmed) return;

    try {
      setRemoving(item.id);
      await api.delete(`/api/catalog/types/${item.id}`);
      showSuccess("Operation completed successfully");
      if (data.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchData();
    } catch (e) {
      showError(e);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <div className="card mt-3 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Type (Type)</span>
          {loading && <div className="spinner-border spinner-border-sm text-secondary" />}
        </div>

        <div className="card-body">
          {/* SEARCH + ADD */}
          <div className="row mb-3 g-2">
            <div className="col-md-4">
              <input
                className="form-control rounded"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-8 text-end">
              <button
                className="btn btn-primary"
                onClick={() => { clearForm(); setOpen(true); }}
              >
                + Add
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Product</th>
                  <th width="140" className="text-center">Manage</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="text-center text-muted">Loading...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan="5" className="text-center text-muted">No data</td></tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.name}</td>
                      <td>{item.category?.name}</td>
                      <td>{item._count?.products ?? 0}</td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-primary btn-sm me-2"
                          disabled={!!removing}
                          onClick={() => handleEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          disabled={!!removing}
                          onClick={() => handleRemove(item)}
                        >
                          {removing === item.id ? (
                            <><span className="spinner-border spinner-border-sm me-1" role="status" />Delete...</>
                          ) : "Delete"}
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
            <button
              className="btn btn-outline-secondary me-2"
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>Page {page} / {totalPages}</span>
            <button
              className="btn btn-outline-secondary ms-2"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* MODAL */}
      <MyModal
        id="modalType"
        title={form.id ? "Edit" : "Add"}
        open={open}
        onClose={() => { if (saving) return; setOpen(false); }}
      >
        <select
          className="form-select mb-3"
          value={form.categoryId}
          onChange={(e) => handleChange("categoryId", e.target.value)}
          disabled={saving}
        >
          <option value="">-- Category --</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          className="form-control mb-3"
          placeholder="Type"
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          disabled={saving}
        />
        <button className="btn btn-primary w-100" onClick={handleSave} disabled={saving}>
          {saving ? (
            <><span className="spinner-border spinner-border-sm me-2" role="status" />Saving...</>
          ) : "Save"}
        </button>
      </MyModal>
    </>
  );
}


