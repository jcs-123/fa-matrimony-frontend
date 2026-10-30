import { useState } from 'react';
import api from '../../api';
import { useAsync } from '../../lib/useAsync';
import { useToast } from '../../context/ToastContext';
import { ErrorBox, Loading } from '../../components/ui';
import { Seg } from './parts';

const CATEGORIES = [
  {
    key: 'dioceses',
    listKey: 'dioceseList',
    title: 'Dioceses',
    singular: 'Diocese',
    icon: 'fa-solid fa-church',
    placeholder: 'Enter diocese name…',
    usedIn: 'Register, Quick Search, Search Filters, Match & Admin Add Member',
    createFn: (b) => api.createDiocese(b),
    updateFn: (id, b) => api.updateDiocese(id, b),
    deleteFn: (id) => api.deleteDiocese(id)
  },
  {
    key: 'parishes',
    listKey: 'parishList',
    title: 'Parishes',
    singular: 'Parish',
    icon: 'fa-solid fa-house-chimney',
    placeholder: 'Enter parish name…',
    usedIn: 'Register, Admin Add Member & Profile Verification',
    createFn: (b) => api.createParish(b),
    updateFn: (id, b) => api.updateParish(id, b),
    deleteFn: (id) => api.deleteParish(id)
  },
  {
    key: 'jobGroups',
    listKey: 'jobList',
    title: 'Jobs / Professions',
    singular: 'Job',
    icon: 'fa-solid fa-briefcase',
    placeholder: 'Enter job / profession name…',
    usedIn: 'Register, Quick Search, Search Filters, Match & Admin Add Member',
    createFn: (b) => api.createJob(b),
    updateFn: (id, b) => api.updateJob(id, b),
    deleteFn: (id) => api.deleteJob(id)
  },
  {
    key: 'eduGroups',
    listKey: 'educationList',
    title: 'Education / Qualifications',
    singular: 'Education',
    icon: 'fa-solid fa-graduation-cap',
    placeholder: 'Enter education / qualification…',
    usedIn: 'Register, Quick Search, Search Filters, Match & Admin Add Member',
    createFn: (b) => api.createEducation(b),
    updateFn: (id, b) => api.updateEducation(id, b),
    deleteFn: (id) => api.deleteEducation(id)
  }
];

const TABS = [
  ['all', 'All Categories'],
  ['dioceses', 'Dioceses'],
  ['parishes', 'Parishes'],
  ['jobGroups', 'Jobs / Professions'],
  ['eduGroups', 'Education']
];

export default function Lookups() {
  const toast = useToast();
  const { data: look, loading, error, reload, setData } = useAsync(() => api.getLookups(), []);
  const [tab, setTab] = useState('all');
  const [newInputs, setNewInputs] = useState({ jobGroups: '', parishes: '', eduGroups: '', dioceses: '' });
  const [parishDiocese, setParishDiocese] = useState('');
  const [editing, setEditing] = useState(null); // { key, id, value, diocese }
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorBox error={error} />;
  if (loading && !look) return <Loading />;

  const dioceseOptions = look?.dioceses || [];

  const handleAdd = async (cat, e) => {
    e.preventDefault();
    const val = (newInputs[cat.key] || '').trim();
    if (!val) return toast(`Please enter a ${cat.singular.toLowerCase()} name`);
    const isParish = cat.key === 'parishes';
    const selectedDiocese = isParish ? (parishDiocese || dioceseOptions[0] || '').trim() : '';
    if (isParish && dioceseOptions.length > 0 && !selectedDiocese) {
      return toast('Please select a Diocese for this parish');
    }
    const list = look?.[cat.listKey] || [];
    if (
      list.some(
        (x) =>
          x.name.toLowerCase() === val.toLowerCase() &&
          (!isParish || (x.diocese || '').toLowerCase() === selectedDiocese.toLowerCase())
      )
    ) {
      return toast(`"${val}" is already in ${cat.title}`);
    }
    setBusy(true);
    try {
      const payload = { name: val, displayOrder: list.length + 1 };
      if (isParish) payload.diocese = selectedDiocese;
      const res = await cat.createFn(payload);
      const createdDoc = res?.data || { id: val, name: val, diocese: selectedDiocese, displayOrder: list.length + 1 };
      const nextList = [...list, createdDoc];
      setData((prev) => ({
        ...(prev || {}),
        [cat.listKey]: nextList,
        [cat.key]: nextList.map((d) => d.name)
      }));
      setNewInputs((prev) => ({ ...prev, [cat.key]: '' }));
      reload();
      toast(`${cat.singular} "${val}" added to database`, 3000);
    } catch (err) {
      toast(err.message || `Could not add ${cat.singular.toLowerCase()}`, 4000);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (cat, doc) => {
    if (!window.confirm(`Delete "${doc.name}" from ${cat.title}?`)) return;
    setBusy(true);
    try {
      await cat.deleteFn(doc.id);
      const list = (look?.[cat.listKey] || []).filter((x) => x.id !== doc.id);
      setData((prev) => ({
        ...(prev || {}),
        [cat.listKey]: list,
        [cat.key]: list.map((d) => d.name)
      }));
      reload();
      toast(`${cat.singular} "${doc.name}" deleted`, 3000);
    } catch (err) {
      toast(err.message || 'Could not delete item', 4000);
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (cat, idx, dir) => {
    const list = [...(look?.[cat.listKey] || [])];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const currentDoc = list[idx];
    const swapDoc = list[targetIdx];
    setBusy(true);
    try {
      await Promise.all([
        cat.updateFn(currentDoc.id, { displayOrder: targetIdx + 1 }),
        cat.updateFn(swapDoc.id, { displayOrder: idx + 1 })
      ]);
      reload();
    } catch (err) {
      toast(err.message || 'Could not reorder items', 4000);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async (cat) => {
    if (!editing || editing.key !== cat.key) return;
    const val = editing.value.trim();
    if (!val) return toast(`Please enter a ${cat.singular.toLowerCase()} name`);
    setBusy(true);
    try {
      const payload = { name: val };
      if (cat.key === 'parishes') payload.diocese = (editing.diocese || '').trim();
      await cat.updateFn(editing.id, payload);
      const list = (look?.[cat.listKey] || []).map((x) =>
        x.id === editing.id ? { ...x, name: val, ...(cat.key === 'parishes' ? { diocese: payload.diocese } : {}) } : x
      );
      setData((prev) => ({
        ...(prev || {}),
        [cat.listKey]: list,
        [cat.key]: list.map((d) => d.name)
      }));
      setEditing(null);
      reload();
      toast(`${cat.singular} updated to "${val}"`, 3000);
    } catch (err) {
      toast(err.message || 'Could not update item', 4000);
    } finally {
      setBusy(false);
    }
  };

  const visibleCategories = tab === 'all'
    ? CATEGORIES
    : CATEGORIES.filter((c) => c.key === tab);

  return (
    <div className="lookups-page">
      <section className="panel lookups-header-panel">
        <div className="panel-h lookups-head">
          <h2><i className="fa-solid fa-database" />Manage Dropdown Master Data (MongoDB)</h2>
          <div className="lookups-controls">
            <Seg value={tab} onChange={setTab} options={TABS} />
            <button type="button" className="btn btn-outline btn-sm lookups-refresh-btn" onClick={reload} disabled={busy}>
              <i className="fa-solid fa-rotate" /> Refresh DB
            </button>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13.5, margin: '4px 0 0' }}>
          Only items added below are stored in MongoDB and displayed in the dropdowns across <b>Registration</b>, <b>Quick Search</b>, <b>Search Filters</b>, <b>Match</b>, and <b>Admin Add / Verify Member</b>.
        </p>
      </section>

      <div className={`lookups-grid${visibleCategories.length === 1 ? ' single' : ''}`}>
        {visibleCategories.map((cat) => {
          const items = look?.[cat.listKey] || [];
          return (
            <section key={cat.key} className="panel lookup-card">
              <div className="panel-h lookup-card-h">
                <h2>
                  <i className={cat.icon} /> {cat.title}
                </h2>
                <span className="pill active" style={{ fontSize: 12 }}>{items.length} in DB</span>
              </div>
              <small className="muted lookup-used-in">Used in: {cat.usedIn}</small>

              <form onSubmit={(e) => handleAdd(cat, e)} className="lookup-add-form">
                {cat.key === 'parishes' && (
                  <select
                    className="select"
                    value={parishDiocese}
                    onChange={(e) => setParishDiocese(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Select Diocese for Parish *</option>
                    {dioceseOptions.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                )}
                <div className="lookup-input-row">
                  <input
                    className="input"
                    placeholder={cat.placeholder}
                    value={newInputs[cat.key] || ''}
                    onChange={(e) => setNewInputs((prev) => ({ ...prev, [cat.key]: e.target.value }))}
                    disabled={busy}
                  />
                  <button type="submit" className="btn btn-primary btn-sm lookup-add-btn" disabled={busy}>
                    <i className="fa-solid fa-plus" /> Add {cat.singular}
                  </button>
                </div>
              </form>

              <div className="tbl-wrap lookup-tbl-wrap">
                <table className="tbl lookup-tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 42 }}>#</th>
                      <th>{cat.singular} Name{cat.key === 'parishes' ? ' & Diocese' : ''}</th>
                      <th style={{ width: 140, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                          No {cat.title.toLowerCase()} in database yet. Add one above.
                        </td>
                      </tr>
                    ) : (
                      items.map((doc, idx) => {
                        const isEdit = editing?.key === cat.key && editing?.id === doc.id;
                        return (
                          <tr key={doc.id || `${doc.name}-${idx}`}>
                            <td className="muted" style={{ fontSize: 12.5 }}>{idx + 1}</td>
                            <td className="lookup-name-cell">
                              {isEdit ? (
                                <div className="lookup-edit-box">
                                  {cat.key === 'parishes' && (
                                    <select
                                      className="select"
                                      style={{ height: 34, fontSize: 13 }}
                                      value={editing.diocese || ''}
                                      onChange={(e) => setEditing({ ...editing, diocese: e.target.value })}
                                    >
                                      <option value="">Select Diocese</option>
                                      {dioceseOptions.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                      ))}
                                    </select>
                                  )}
                                  <div className="lookup-edit-row">
                                    <input
                                      className="input"
                                      style={{ height: 34, fontSize: 13.5 }}
                                      value={editing.value}
                                      autoFocus
                                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEdit(cat);
                                        if (e.key === 'Escape') setEditing(null);
                                      }}
                                    />
                                    <button type="button" className="ibtn ok" title="Save" onClick={() => handleSaveEdit(cat)}>
                                      <i className="fa-solid fa-check" />
                                    </button>
                                    <button type="button" className="ibtn" title="Cancel" onClick={() => setEditing(null)}>
                                      <i className="fa-solid fa-xmark" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="lookup-name-wrap">
                                  <b>{doc.name}</b>
                                  {cat.key === 'parishes' && (
                                    <div className="muted lookup-diocese-sub">
                                      <i className="fa-solid fa-church" style={{ marginRight: 4, fontSize: 11 }} />
                                      {doc.diocese || 'No diocese assigned'}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="lookup-acts-cell">
                              <div className="row-acts lookup-row-acts">
                                <button
                                  type="button"
                                  className="ibtn"
                                  title="Move up"
                                  disabled={idx === 0 || busy}
                                  onClick={() => handleMove(cat, idx, -1)}
                                >
                                  <i className="fa-solid fa-arrow-up" />
                                </button>
                                <button
                                  type="button"
                                  className="ibtn"
                                  title="Move down"
                                  disabled={idx === items.length - 1 || busy}
                                  onClick={() => handleMove(cat, idx, 1)}
                                >
                                  <i className="fa-solid fa-arrow-down" />
                                </button>
                                <button
                                  type="button"
                                  className="ibtn"
                                  title="Edit"
                                  disabled={busy}
                                  onClick={() => setEditing({ key: cat.key, id: doc.id, value: doc.name, diocese: doc.diocese || '' })}
                                >
                                  <i className="fa-solid fa-pen" />
                                </button>
                                <button
                                  type="button"
                                  className="ibtn del"
                                  title="Delete"
                                  disabled={busy}
                                  onClick={() => handleDelete(cat, doc)}
                                >
                                  <i className="fa-regular fa-trash-can" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
