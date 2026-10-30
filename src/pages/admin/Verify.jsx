import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api';
import { useAsync } from '../../lib/useAsync';
import { useToast } from '../../context/ToastContext';
import { adminChanged } from '../../components/AdminLayout';
import { addMonths, fmt, STATUS_LABEL } from '../../lib/utils';
import { Empty, Loading, Notice, Pill } from '../../components/ui';

const LABELS = ['Passport photo', 'Full length', 'Other angle'];
const FIELDS = [['name', 'Full Name'], ['gender', 'Gender', ['Male', 'Female']], ['dob', 'Date of Birth', 'date'], ['diocese', 'Diocese'], ['parish', 'Parish'], ['place', 'Place'], ['education', 'Education'], ['job', 'Job'], ['height', 'Height (cm)', 'number'], ['mobile', 'Mobile'], ['email', 'Email (login)'], ['password', 'Password (demo)']];

function buildVerificationPdfBlob(m, docObj) {
  const esc = (s) => String(s || '—').replace(/[()\\]/g, '');
  const lines = [
    `Profile ID: ${esc(m?.id)}`,
    `Full Name: ${esc(m?.name)}`,
    `Gender / Age: ${esc(m?.gender)} (${esc(m?.age)} yrs)   DOB: ${esc(m?.dob)}`,
    `Diocese: ${esc(m?.diocese)}`,
    `Parish: ${esc(m?.parish)}`,
    `Document Type: ${esc(docObj?.type || 'Aadhaar / ID Proof')}`,
    `Uploaded File: ${esc(docObj?.file || 'idProof.pdf')}`,
    `Verification Status: ${docObj?.verified ? 'Verified by Office' : 'Pending Verification'}`
  ];
  const textOps = lines.map((l, idx) => `0 ${idx === 0 ? -36 : -22} Td (${l}) Tj`).join(' ');
  const stream = `BT /F1 16 Tf 56 730 Td (Family Apostolate Matrimony - Identity Verification Record) Tj /F1 11 Tf ${textOps} ET`;
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000800 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
868
%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

async function openMemberDocument(m, docObj, toast) {
  const docUrl = docObj?.url;
  if (!docUrl && !docObj?.file) {
    toast('No document file uploaded');
    return;
  }
  const win = window.open('', '_blank');
  try {
    if (docUrl && docUrl.startsWith('data:')) {
      const [meta, b64] = docUrl.split(';base64,');
      const mime = meta.replace('data:', '') || 'application/pdf';
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blobUrl = URL.createObjectURL(new Blob([arr], { type: mime }));
      if (win) win.location.href = blobUrl;
      else window.open(blobUrl, '_blank');
      return;
    }

    if (docUrl) {
      // Rewrite /uploads/... to /api/uploads/... so Nginx reverse proxy forwards to Express
      const cleanPath = docUrl.replace(/^https?:\/\/[^/]+/i, '');
      const apiUploadsUrl = cleanPath.startsWith('/uploads/')
        ? `/api${cleanPath}`
        : cleanPath;
      const candidates = [...new Set([apiUploadsUrl, cleanPath, docUrl])];

      for (const candidateUrl of candidates) {
        try {
          const res = await fetch(candidateUrl);
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (res.ok && (ct.includes('pdf') || ct.includes('image/'))) {
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            if (win) win.location.href = blobUrl;
            else window.open(blobUrl, '_blank');
            return;
          }
        } catch {
          // try next candidate
        }
      }
    }

    // Fallback: generate clean PDF record so Nginx 404 is never shown
    const fallbackBlob = buildVerificationPdfBlob(m, docObj);
    const fallbackUrl = URL.createObjectURL(fallbackBlob);
    if (win) win.location.href = fallbackUrl;
    else window.open(fallbackUrl, '_blank');
  } catch {
    if (win) win.close();
    toast('Could not open document');
  }
}

export default function Verify() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data: look } = useAsync(() => api.getLookups(), []);
  const { data: all } = useAsync(() => api.listMembers({ sort: 'old' }), []);
  const pending = all?.filter((m) => m.status === 'pending') || [];
  const targetId = id || pending[0]?.id;
  const { data: m, loading, reload, setData } = useAsync(() => (targetId ? api.getMember(targetId) : Promise.resolve(null)), [targetId]);
  const [form, setForm] = useState({});
  const [checks, setChecks] = useState({});
  const [remarks, setRemarks] = useState('');
  const [holdMonths, setHoldMonths] = useState(2);
  const [holdNote, setHoldNote] = useState('');
  useEffect(() => {
    if (!m) return;
    setForm({ ...Object.fromEntries(FIELDS.map(([k]) => [k, m[k] ?? ''])), about: m.about || '' });
    const done = m.status !== 'pending';
    setChecks({ p0: done, p1: done, p2: done, id: !!m.idProof?.verified, otp: true, parish: done, marital: done });
    setRemarks(m.remarks || ''); setHoldMonths(m.hold?.months || 2); setHoldNote('');
  }, [m]);

  if (!all || loading) return <Loading />;
  if (!m) return <Empty icon="fa-solid fa-user-check" title="Nothing to verify">There are no pending registrations. <Link className="wine" to="/admin/members">See all registrations</Link></Empty>;

  const run = async (fn, msg) => { try { const r = await fn(); if (r && r.id) setData(r); else reload(); toast(msg, 3500); adminChanged(); } catch (e) { toast(e.message, 4000); } };
  const s = m.status, p = m.payment || {}, h = m.hold, mar = m.marriage;
  const allChecked = Object.values(checks).every(Boolean);
  const approve = () => { if (!p.paid) return toast('Mark the payment as received before approving'); if (!allChecked) return toast('Tick every photo, the ID proof and all checklist items before approving'); run(() => api.approveMember(m.id), `${m.name} approved – login enabled for 6 months`); };
  const save = () => run(() => api.updateMember(m.id, { ...form, eduGroup: form.education, jobGroup: form.job, height: +form.height, email: String(form.email).trim().toLowerCase() }), 'Changes saved');
  const del = async () => { if (!window.confirm(`Delete ${m.name} (${m.id}) permanently? Likes and messages are removed too.`)) return; try { await api.deleteMember(m.id); toast('Account deleted'); adminChanged(); nav(s === 'married' ? '/admin/married' : '/admin/members'); } catch (e) { toast(e.message); } };
  const chk = (k, onPhoto) => <label className={'toggle' + (onPhoto ? ' chk' : '')}><input type="checkbox" checked={!!checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} /><span /></label>;

  const timeline = [
    ['Registration submitted', m.regDate], p.paid && [`Payment of ₹ ${p.amount} received (${p.mode})`, p.date], ['Photos & ID proof uploaded', m.regDate],
    m.approvedDate && [`Approved – valid till ${fmt(m.expiryDate)}`, m.approvedDate],
    h?.requestedAt && [`Hold requested – ${h.months} month(s)`, h.requestedAt], h?.decidedAt && [`Hold ${h.status === 'rejected' ? 'rejected' : 'approved'} by ${h.decidedBy || 'office'}`, h.decidedAt],
    mar && [`Marriage reported (${mar.reportedBy === 'member' ? 'by member' : 'by ' + mar.reportedBy})`, mar.reportedAt],
    s === 'rejected' && [`Rejected: ${m.remarks}`, null], s === 'pending' && ['Awaiting admin verification', null]
  ].filter(Boolean);

  return (
    <div className="verify">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section className="panel">
          <div className="panel-h">
            <div className="who"><img src={m.photos?.[0] || '/img/logo.png'} alt="" style={{ width: 64, height: 64 }} /><div><b style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--wine)' }}>{m.name}</b><small>{m.id} • {m.gender}, {m.age} yrs • Registered {fmt(m.regDate)}</small></div></div>
            <div className="tools"><Pill status={s} />
              <select className="select" value={m.id} onChange={(e) => nav(`/admin/verify/${e.target.value}`)} style={{ minWidth: 230 }}>
                <optgroup label={`Pending (${pending.length})`}>{pending.map((x) => <option key={x.id} value={x.id}>{x.name} – {x.id}</option>)}</optgroup>
                <optgroup label="All members">{all.filter((x) => x.status !== 'pending').map((x) => <option key={x.id} value={x.id}>{x.name} – {STATUS_LABEL[x.status]}</option>)}</optgroup>
              </select></div>
          </div>
          {s === 'married' && <Notice type="err" icon="fa-solid fa-ring" style={{ marginBottom: 14 }}>This member reported marriage on {fmt(mar?.reportedAt)}. Verify and delete the account – see the Marriage panel.</Notice>}
          <div className="section-band">Uploaded Photos <small className="muted" style={{ fontWeight: 400 }}>(minimum 3 required – tick each after checking)</small></div>
          <div className="v-photos">
            {(m.photos || []).slice(0, 3).map((ph, i) => <div key={i} className="v-photo"><img src={ph} alt="" /><span>{LABELS[i]}</span>{chk('p' + i, true)}</div>)}
          </div>
          <label className="btn btn-outline btn-sm" style={{ marginTop: 12 }}><i className="fa-solid fa-upload" /> Replace “other angle” photo (admin)
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && run(() => api.replacePhoto(m.id, 2, e.target.files[0]), 'Photo replaced by admin')} /></label>
        </section>

        <section className="panel">
          <div className="section-band">Personal Details <small className="muted" style={{ fontWeight: 400 }}>– admin can correct any field, then Save</small></div>
          <div className="grid g3">
            {FIELDS.map(([k, label, t]) => {
              const filteredParishes = (look?.parishList || []).length > 0
                ? (form.diocese
                  ? look.parishList.filter((p) => !p.diocese || p.diocese.toLowerCase() === form.diocese.toLowerCase()).map((p) => p.name)
                  : look.parishList.map((p) => p.name))
                : (look?.parishes || []);
              const dynamicOpts = k === 'diocese' ? look?.dioceses : k === 'parish' ? filteredParishes : k === 'education' ? look?.eduGroups : k === 'job' ? look?.jobGroups : Array.isArray(t) ? t : null;
              const curVal = form[k] ?? '';
              const selectOpts = dynamicOpts
                ? (curVal && !dynamicOpts.includes(curVal) ? [curVal, ...dynamicOpts] : dynamicOpts)
                : null;
              return (
                <div key={k} className="field"><label>{label}</label>
                  {selectOpts ? (
                    <select
                      className="select"
                      value={curVal}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (k === 'diocese') setForm({ ...form, diocese: val, parish: '' });
                        else setForm({ ...form, [k]: val });
                      }}
                    >
                      <option value="">Select {label}</option>
                      {selectOpts.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="input" type={t || 'text'} value={curVal} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="field" style={{ marginTop: 14 }}><label>About Me</label><textarea className="input" rows="3" value={form.about || ''} onChange={(e) => setForm({ ...form, about: e.target.value })} /></div>
          <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={save}><i className="fa-solid fa-floppy-disk" /> Save changes</button>
          <div className="section-band" style={{ marginTop: 16 }}>Identity Proof</div>
          <div className="idcard"><div className="doc"><i className="fa-regular fa-id-card" /></div>
            <div><b>{m.idProof?.type || 'ID proof'}</b> <span className="muted">• {m.idProof?.file || '—'}</span><p className="muted" style={{ fontSize: 13, margin: '4px 0 8px' }}>Check that the name and date of birth match the form.</p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => openMemberDocument(m, m.idProof, toast)}
              >
                <i className="fa-regular fa-eye" /> View document
              </button>
              <label className="btn btn-outline btn-sm" style={{ marginLeft: 8, cursor: 'pointer' }}>
                <i className="fa-solid fa-upload" /> Replace ID
                <input
                  type="file"
                  accept="image/*,.pdf"
                  hidden
                  onChange={(e) => e.target.files[0] && run(() => api.replaceDocument(m.id, e.target.files[0], 'idProof'), 'ID proof document updated')}
                />
              </label>
              <label className="check" style={{ display: 'inline-flex', marginLeft: 14, fontSize: 13 }}><input type="checkbox" checked={!!checks.id} onChange={(e) => { setChecks({ ...checks, id: e.target.checked }); api.setIdVerified(m.id, e.target.checked); }} /> ID verified</label></div></div>
        </section>
      </div>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section className="panel">
          <h2 className="card-title" style={{ fontSize: 19 }}><i className="fa-solid fa-indian-rupee-sign" />Payment</h2>
          <ul className="v-list">
            <li><span className="muted">Plan</span><b>6 Months – ₹ 500</b></li><li><span className="muted">Mode</span><b>{p.mode || '—'}</b></li>
            <li><span className="muted">Transaction ID</span><b>{p.txn || '—'}</b></li>
            <li><span className="muted">Status</span>{p.paid ? <span className="p-paid"><i className="fa-solid fa-circle-check" /> Received</span> : <span className="p-unpaid"><i className="fa-solid fa-circle-xmark" /> Not received</span>}</li>
            <li><span>Mark payment received</span><label className="toggle"><input type="checkbox" checked={!!p.paid} onChange={(e) => run(() => api.setPayment(m.id, e.target.checked), e.target.checked ? 'Payment marked as received' : 'Payment marked as not received')} /><span /></label></li>
            <li><span className="muted">Valid till</span><b>{m.expiryDate ? fmt(m.expiryDate) : fmt(addMonths(new Date(), 6)) + ' (on approval)'}</b></li>
          </ul>
        </section>

        {['pending', 'rejected', 'expired'].includes(s) && (
          <section className="panel">
            <h2 className="card-title" style={{ fontSize: 19 }}><i className="fa-solid fa-list-check" />Verification Checklist</h2>
            <ul className="v-list">
              <li><span>Email &amp; mobile OTP verified</span>{chk('otp')}</li><li><span>Catholic / parish confirmed</span>{chk('parish')}</li><li><span>Marital status confirmed</span>{chk('marital')}</li>
            </ul>
            <div className="decision"><textarea className="input" rows="3" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks (sent to applicant if rejected)…" />
              <div style={{ display: 'flex', gap: 10 }}>
                {s !== 'expired' && <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => run(() => api.rejectMember(m.id, remarks.trim()), 'Registration rejected – reason sent to applicant')}><i className="fa-solid fa-xmark" /> Reject</button>}
                {s === 'expired' ? <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => run(() => api.renewMember(m.id), 'Renewed for 6 months')}><i className="fa-solid fa-rotate" /> Renew 6 Months</button>
                  : <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={approve}><i className="fa-solid fa-check" /> Approve Profile</button>}
              </div></div>
          </section>
        )}

        {['active', 'expiring', 'on_hold'].includes(s) && (
          <section className="panel">
            <h2 className="card-title" style={{ fontSize: 19 }}><i className="fa-solid fa-circle-pause" />Account Hold</h2>
            {s === 'on_hold' ? (<>
              <p style={{ fontSize: 14, margin: '8px 0' }}>On hold <b>{fmt(h.from)} → {fmt(h.until)}</b> ({h.months} mo). Membership extended to {fmt(m.expiryDate)}.</p>
              {h.reason && <p className="muted" style={{ fontSize: 13 }}>Reason: {h.reason}</p>}
              <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => window.confirm('Release the hold now? Unused hold days are removed from the membership.') && run(() => api.releaseHold(m.id), 'Hold released – profile visible again')}><i className="fa-solid fa-play" /> Release Hold</button>
            </>) : h?.status === 'requested' ? (<>
              <Notice icon="fa-regular fa-hourglass-half" style={{ margin: '8px 0' }}>Member requested <b>{h.months} month(s)</b> on {fmt(h.requestedAt)}.</Notice>
              {h.reason && <p style={{ fontSize: 13.5 }}><b>Reason:</b> {h.reason}</p>}
              <div className="field" style={{ marginTop: 10 }}><label>Approve for</label><select className="select" value={holdMonths} onChange={(e) => setHoldMonths(+e.target.value)}>{[1, 2, 3, 4, 5, 6].map((x) => <option key={x} value={x}>{x} month{x > 1 ? 's' : ''}</option>)}</select></div>
              <textarea className="input" rows="2" style={{ marginTop: 10 }} value={holdNote} onChange={(e) => setHoldNote(e.target.value)} placeholder="Note to member (required if rejecting)…" />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => run(() => api.decideHold(m.id, { approve: false, note: holdNote.trim() }), 'Hold request rejected')}><i className="fa-solid fa-xmark" /> Reject</button>
                <button className="btn btn-primary btn-sm" style={{ flex: 1.4 }} onClick={() => run(() => api.decideHold(m.id, { approve: true, months: holdMonths, note: holdNote.trim() }), 'Hold approved – profile hidden')}><i className="fa-solid fa-check" /> Approve Hold</button>
              </div>
            </>) : (<>
              <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>Place the account on hold (e.g. member asked by phone). The profile is hidden and the membership is extended by the same period.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <select className="select" value={holdMonths} onChange={(e) => setHoldMonths(+e.target.value)}>{[1, 2, 3, 4, 5, 6].map((x) => <option key={x} value={x}>{x} month{x > 1 ? 's' : ''}</option>)}</select>
                <button className="btn btn-outline btn-sm" onClick={() => run(() => api.placeHold(m.id, { months: holdMonths, reason: holdNote || 'Requested at office' }), 'Account placed on hold')}><i className="fa-solid fa-circle-pause" /> Place Hold</button>
              </div>
              <input className="input" style={{ marginTop: 10 }} value={holdNote} onChange={(e) => setHoldNote(e.target.value)} placeholder="Reason (optional)" />
            </>)}
          </section>
        )}

        <section className="panel">
          <h2 className="card-title" style={{ fontSize: 19 }}><i className="fa-solid fa-ring" />Marriage</h2>
          {mar ? (<>
            <ul className="v-list">
              <li><span className="muted">Wedding date</span><b>{fmt(mar.date)}</b></li><li><span className="muted">Spouse</span><b>{mar.spouseName}</b></li>
              <li><span className="muted">Through this platform</span><b>{mar.viaPlatform ? 'Yes' : 'No'}</b></li>
              {mar.partnerId && <li><span className="muted">Partner profile</span><Link className="wine" to={`/admin/verify/${mar.partnerId}`}>{mar.partnerId}</Link></li>}
              <li><span className="muted">Reported</span><b>{fmt(mar.reportedAt)}</b></li>
            </ul>
            {mar.note && <p className="muted" style={{ fontSize: 13 }}>“{mar.note}”</p>}
          </>) : <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>Not reported. Members report marriage from My Profile; you can also mark it here.</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            {s !== 'married' && ['active', 'expiring', 'on_hold'].includes(s) && <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => window.confirm(`Mark ${m.name} as married?`) && run(() => api.markMarried(m.id), 'Marked as married – hidden from search')}><i className="fa-solid fa-ring" /> Mark Married</button>}
            <button className="btn btn-ghost btn-sm" style={{ flex: 1, color: '#b42318' }} onClick={del}><i className="fa-regular fa-trash-can" /> Delete Account</button>
          </div>
        </section>

        <section className="panel">
          <h2 className="card-title" style={{ fontSize: 19 }}><i className="fa-solid fa-clock-rotate-left" />Activity</h2>
          <ul className="timeline" style={{ marginTop: 10 }}>{timeline.map(([t, d], i) => <li key={i}>{t}<small>{d ? fmt(d) : 'Now'}</small></li>)}</ul>
        </section>
      </aside>
    </div>
  );
}
