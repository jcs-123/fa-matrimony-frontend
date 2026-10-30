import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { useAsync } from '../../lib/useAsync';
import { useToast } from '../../context/ToastContext';
import { adminChanged } from '../../components/AdminLayout';
import { fmt } from '../../lib/utils';
import { ErrorBox, Loading, Modal, Pill } from '../../components/ui';
import { Seg } from './parts';

const FILTERS = [['all', 'All'], ['pending', 'Pending'], ['active', 'Active'], ['expiring', 'Expiring'], ['on_hold', 'On Hold'], ['expired', 'Expired'], ['married', 'Married'], ['rejected', 'Rejected']];
const PER = 10;

export default function Members() {
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') || 'all';
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('new');
  const [page, setPage] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const { data: rows, loading, error, reload } = useAsync(() => api.listMembers({ status, q, sort }), [status, q, sort]);
  useEffect(() => setPage(0), [status, q, sort]);
  const act = async (m, a) => {
    try {
      if (a === 'approve') { await api.approveMember(m.id); toast(`${m.name} approved – valid for 6 months`); }
      if (a === 'notify') { const r = await api.notifyRenewal([m.id]); toast(r?.message || `Renewal reminder email sent to ${m.name}`); }
      if (a === 'renew') { await api.renewMember(m.id); toast(`${m.name} renewed for 6 months`); }
      if (a === 'married') { if (!window.confirm(`Mark ${m.name} as married? The profile will be hidden and moved to “Married – Delete”.`)) return; await api.markMarried(m.id); toast(`${m.name} moved to Married – Delete`); }
      if (a === 'release_hold') { if (!window.confirm(`Release hold on ${m.name}'s account and reactivate profile now?`)) return; await api.releaseHold(m.id); toast(`Hold released for ${m.name} – profile reactivated`); }
      if (a === 'delete') { if (!window.confirm(`Delete ${m.name} (${m.id}) permanently? Likes and messages are removed too.`)) return; await api.deleteMember(m.id); toast('Account deleted'); }
      reload(); adminChanged();
    } catch (e) { toast(e.message, 4000); }
  };
  const pages = Math.max(1, Math.ceil((rows?.length || 0) / PER));
  const shown = rows?.slice(page * PER, (page + 1) * PER) || [];

  return (
    <>
      <section className="panel">
        <div className="panel-h">
          <h2><i className="fa-solid fa-users" />Registrations</h2>
          <Seg value={status} onChange={(v) => setSp(v === 'all' ? {} : { status: v })} options={FILTERS} />
          <div className="tools">
            <div style={{ position: 'relative' }}><i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: 11, color: 'var(--muted)' }} /><input className="input" style={{ paddingLeft: 34, width: 230 }} placeholder="Search name, ID, diocese…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}><option value="new">Newest registration first</option><option value="old">Oldest registration first</option></select>
            <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}><i className="fa-solid fa-user-plus" /> Add Member</button>
          </div>
        </div>
        {error ? <ErrorBox error={error} /> : loading && !rows ? <Loading /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Member</th><th className="sortable" onClick={() => setSort(sort === 'new' ? 'old' : 'new')}>Registered On<i className={sort === 'new' ? 'fa-solid fa-arrow-down-wide-short' : 'fa-solid fa-arrow-up-short-wide'} /></th><th>Diocese</th><th>Payment</th><th>Subscription Ends</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '24px' }}>No registrations found.</td></tr>
                ) : (
                  shown.map((m) => {
                    const s = m.effectiveStatus || m.status;
                    return (
                      <tr key={m.id}>
                        <td><div className="who"><img src={m.photos?.[0] || '/img/logo.png'} alt="" /><div><b>{m.name}</b><small>{m.id} • {m.gender}, {m.age}</small></div></div></td>
                        <td>{fmt(m.regDate)}</td><td>{m.diocese}</td>
                        <td>{m.payment?.paid ? <span className="p-paid"><i className="fa-solid fa-circle-check" /> ₹{m.payment.amount} · {m.payment.mode}</span> : <span className="p-unpaid"><i className="fa-solid fa-circle-xmark" /> Unpaid</span>}</td>
                        <td>{fmt(m.expiryDate)}{m.daysLeft !== null && m.daysLeft !== undefined && !['married', 'rejected'].includes(s) && <><br /><small className="muted">{s === 'on_hold' ? `on hold till ${fmt(m.hold?.until)}` : m.daysLeft < 0 ? `${-m.daysLeft} days ago` : `${m.daysLeft} days left`}</small></>}</td>
                        <td><Pill status={s} />{m.hold?.status === 'requested' && <><br /><small className="wine" style={{ fontSize: 11.5 }}>Hold requested</small></>}</td>
                        <td><div className="row-acts">
                          <Link className="ibtn" title="View / Verify" to={`/admin/verify/${m.id}`}><i className="fa-regular fa-eye" /></Link>
                          {s === 'pending' && <button className="ibtn ok" title="Approve" onClick={() => act(m, 'approve')}><i className="fa-solid fa-check" /></button>}
                          {s === 'on_hold' && <button className="ibtn ok" title="Release hold (reactivate profile)" onClick={() => act(m, 'release_hold')}><i className="fa-solid fa-play" /></button>}
                          {['expiring', 'expired'].includes(s) && <button className="ibtn" title="Send renewal reminder" onClick={() => act(m, 'notify')}><i className="fa-regular fa-bell" /></button>}
                          {s === 'expired' && <button className="ibtn ok" title="Renew 6 months (payment received)" onClick={() => act(m, 'renew')}><i className="fa-solid fa-rotate" /></button>}
                          {['active', 'expiring', 'on_hold'].includes(s) && <button className="ibtn" title="Mark as married" onClick={() => act(m, 'married')}><i className="fa-solid fa-ring" /></button>}
                          {['expired', 'married', 'rejected'].includes(s) && <button className="ibtn del" title="Delete account" onClick={() => act(m, 'delete')}><i className="fa-regular fa-trash-can" /></button>}
                        </div></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="tbl-foot">
          <span>Showing <b>{rows?.length ? `${page * PER + 1}–${Math.min(rows.length, (page + 1) * PER)}` : 0}</b> of <b>{rows?.length || 0}</b> registrations</span>
          <div className="pager" style={{ margin: 0 }}>{Array.from({ length: pages }, (_, i) => <a key={i} href="#p" className={i === page ? 'on' : ''} onClick={(e) => { e.preventDefault(); setPage(i); }}>{i + 1}</a>)}</div>
          <span><i className="fa-solid fa-circle-info wine" /> Subscription = 6 months from approval (extended by any hold). Expired, married &amp; rejected accounts can be deleted.</span>
        </div>
      </section>
      <AddMember open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); setSp({ status: 'pending' }); reload(); adminChanged(); }} />
    </>
  );
}

function AddMember({ open, onClose, onSaved }) {
  const toast = useToast();
  const { data: look, reload: reloadLookups } = useAsync(() => api.getLookups(), []);
  useEffect(() => { if (open) reloadLookups(); }, [open, reloadLookups]);
  const blank = { name: '', gender: 'Male', dob: '', diocese: '', parish: '', place: '', mobile: '', email: '', password: 'welcome123', eduGroup: '', job: '', height: '', paid: false };
  const [f, setF] = useState(blank);
  const [photos, setPhotos] = useState([]);
  const [idProof, setIdProof] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (k === 'diocese') {
      setF({ ...f, diocese: val, parish: '' });
    } else {
      setF({ ...f, [k]: val });
    }
  };
  const filteredParishes = (look?.parishList || []).length > 0
    ? (f.diocese
      ? look.parishList.filter((p) => !p.diocese || p.diocese.toLowerCase() === f.diocese.toLowerCase()).map((p) => p.name)
      : look.parishList.map((p) => p.name))
    : (look?.parishes || []);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const selectedJob = f.job || look?.jobGroups?.[0] || '';
      const selectedEdu = f.eduGroup || look?.eduGroups?.[0] || '';
      await api.createMember({
        ...f,
        diocese: f.diocese || look?.dioceses?.[0] || '',
        parish: f.parish || filteredParishes[0] || '',
        eduGroup: selectedEdu,
        education: selectedEdu,
        job: selectedJob,
        jobGroup: selectedJob,
        height: +f.height || 165
      }, { photos, idProof });
      toast('Member added – open it to verify & approve'); setF(blank); setPhotos([]); onSaved();
    } catch (e2) { toast(e2.message, 4000); } finally { setBusy(false); }
  };
  const I = (k, label, req, type = 'text') => <div className="field"><label>{label} {req && <span className="rq">*</span>}</label><input className="input" type={type} required={req} value={f[k]} onChange={set(k)} /></div>;
  return (
    <Modal open={open} onClose={onClose} width={780}>
      <form onSubmit={save}>
        <h3><i className="fa-solid fa-user-plus" /> Add Member (Office Registration)</h3>
        <div className="grid g3">
          {I('name', 'Full Name', true)}
          <div className="field"><label>Gender <span className="rq">*</span></label><select className="select" value={f.gender} onChange={set('gender')}><option>Male</option><option>Female</option></select></div>
          {I('dob', 'Date of Birth', true, 'date')}
          <div className="field"><label>Diocese</label><select className="select" value={f.diocese} onChange={set('diocese')}><option value="">Select Diocese</option>{look?.dioceses?.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
          <div className="field"><label>Parish</label><select className="select" value={f.parish} onChange={set('parish')}><option value="">Select Parish</option>{filteredParishes.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
          {I('place', 'Place')}{I('mobile', 'Mobile', false, 'tel')}{I('email', 'Email (login)', true, 'email')}{I('password', 'Password', true)}
          <div className="field"><label>Education</label><select className="select" value={f.eduGroup} onChange={set('eduGroup')}>{look?.eduGroups?.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
          <div className="field"><label>Job / Profession</label><select className="select" value={f.job} onChange={set('job')}><option value="">Select Job</option>{look?.jobGroups?.map((j) => <option key={j} value={j}>{j}</option>)}</select></div>
          {I('height', 'Height (cm)', false, 'number')}
          <div className="field"><label>Photos (min 3)</label><input className="input" type="file" multiple accept="image/*" style={{ paddingTop: 8 }} onChange={(e) => setPhotos([...e.target.files])} /></div>
          <div className="field"><label>ID Proof</label><input className="input" type="file" accept="image/*,.pdf" style={{ paddingTop: 8 }} onChange={(e) => setIdProof(e.target.files[0])} /></div>
          <div className="field"><label>&nbsp;</label><label className="check"><input type="checkbox" checked={f.paid} onChange={set('paid')} /> ₹500 paid at office</label></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}><i className="fa-solid fa-floppy-disk" /> Save Member</button></div>
      </form>
    </Modal>
  );
}
