import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAsync } from '../../lib/useAsync';
import { useToast } from '../../context/ToastContext';
import { addMonths, fmt, compressImageFile } from '../../lib/utils';

const STEPS = ['Plan & Register', 'Personal Details', 'Additional Details', 'Upload Documents & Photos', 'Payment', 'Profile Review'];
const TITLES = ['Register Your Profile', 'Personal Details', 'Additional Details', 'Upload Documents & Photos', 'Payment', 'Profile Review'];
const INTERESTS = ['📖 Reading', '🎵 Music', '✈ Travel', '🤝 Volunteering', '🌿 Gardening', '🍳 Cooking', '⛪ Choir', '🏏 Sports', '🎨 Art', '📸 Photography'];
const PAY = [['Office', 'fa-solid fa-hand-holding-heart', 'Pay ₹ 500 at the Family Apostolate office – admin will confirm and activate']];
const PHOTO_SLOTS = [['photo1', 'fa-regular fa-id-badge', 'Passport-size Photo *', 'Front facing, plain background', true], ['photo2', 'fa-solid fa-person', 'Full-length Photo *', 'Standing, full figure visible', true], ['photo3', 'fa-solid fa-camera-rotate', 'Any Other Angle *', 'Side or casual photo', true]];
const DOC_SLOTS = [['idProof', 'fa-regular fa-id-card', 'ID Proof *', 'Aadhaar / Passport / Driving Licence', true], ['parishLetter', 'fa-solid fa-church', 'Parish Letter / Baptism Cert.', 'From your parish vicar (optional)', false], ['extra', 'fa-solid fa-plus', 'Additional Photo', 'Optional', false]];

const INIT = {
  name: '', gender: '', dob: '', diocese: '', place: '', parish: '', email: '', mobile: '', password: '',
  height: '', weight: '', bloodGroup: '', community: 'Syro-Malabar', maritalStatus: 'Never Married', motherTongue: 'Malayalam',
  eduGroup: '', job: '', employer: '', income: 'Prefer not to say', location: '', languages: '',
  father: '', mother: '', familyType: 'Nuclear', brothers: '', sisters: '', familyPhone: '',
  prefAge: '24 – 30', prefEdu: 'Any', prefLoc: 'Within Kerala', about: ''
};
const REQUIRED = { 1: ['name', 'gender', 'dob', 'diocese', 'place', 'parish', 'email', 'mobile', 'password'], 2: ['height', 'eduGroup', 'job', 'location'], 3: [], 4: ['photo1', 'photo2', 'photo3', 'idProof'], 5: [] };

export default function Register() {
  const toast = useToast();
  const { data: look } = useAsync(() => api.getLookups(), []);
  const [step, setStep] = useState(1);
  const [f, setF] = useState(INIT);
  const [files, setFiles] = useState({});
  const [ints, setInts] = useState(['📖 Reading', '✈ Travel']);
  const [pay, setPay] = useState('Office');
  const [terms, setTerms] = useState(false);
  const [bad, setBad] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => {
    const val = e.target.value;
    if (k === 'diocese') {
      setF({ ...f, diocese: val, parish: '' });
    } else {
      setF({ ...f, [k]: val });
    }
  };
  const previews = useMemo(() => Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v?.type?.startsWith('image/') ? URL.createObjectURL(v) : null])), [files]);
  const dioceses = useMemo(() => [['', 'Select Diocese'], ...(look?.dioceses || [])], [look?.dioceses]);
  const parishes = useMemo(() => {
    const pList = look?.parishList || [];
    if (pList.length > 0) {
      const filtered = f.diocese
        ? pList.filter((p) => !p.diocese || p.diocese.toLowerCase() === f.diocese.toLowerCase())
        : pList;
      return [['', 'Select Parish'], ...filtered.map((p) => p.name)];
    }
    return [['', 'Select Parish'], ...(look?.parishes || [])];
  }, [look?.parishList, look?.parishes, f.diocese]);
  const eduOptions = useMemo(() => [['', 'Select Qualification'], ...(look?.eduGroups || [])], [look?.eduGroups]);
  const jobOptions = useMemo(() => [['', 'Select Profession / Job'], ...(look?.jobGroups || [])], [look?.jobGroups]);
  const validity = `${fmt(new Date())} – ${fmt(addMonths(new Date(), 6))}`;

  const validate = (s) => {
    const miss = (REQUIRED[s] || []).filter((k) => (k.startsWith('photo') || k === 'idProof' ? !files[k] : !String(f[k]).trim()));
    if (s === 1) {
      if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) miss.push('email');
      if (f.mobile && !/^\d{10}$/.test(f.mobile.replace(/\D/g, ''))) miss.push('mobile');
      if (f.password && f.password.length < 6) miss.push('password');
    }
    setBad(miss);
    if (miss.length) { toast('Please complete the highlighted fields (*)'); return false; }
    if (s === 1 && !terms) { toast('Please accept the Terms & Privacy Policy'); return false; }
    return true;
  };
  const go = (n) => { setStep(n); setBad([]); window.scrollTo({ top: 300, behavior: 'smooth' }); };
  const next = () => { if (validate(step)) go(step + 1); };

  const submit = async () => {
    for (const s of [1, 2, 4]) if (!validate(s)) { go(s); return; }
    setBusy(true);
    const [aMin, aMax] = f.prefAge.split('–').map((x) => parseInt(x, 10));
    const fields = {
      name: f.name.trim(), gender: f.gender, dob: f.dob, email: f.email.trim().toLowerCase(), password: f.password, mobile: '+91 ' + f.mobile.replace(/\D/g, ''),
      diocese: f.diocese, parish: f.parish, place: f.place, community: f.community, maritalStatus: f.maritalStatus, motherTongue: f.motherTongue,
      height: +f.height, weight: f.weight ? +f.weight : null, bloodGroup: f.bloodGroup, eduGroup: f.eduGroup, education: f.eduGroup, job: f.job, jobGroup: f.job,
      employer: f.employer, income: f.income, location: f.location, languages: f.languages || 'Malayalam',
      family: { father: f.father, mother: f.mother, type: f.familyType, brothers: f.brothers, sisters: f.sisters, phone: f.familyPhone, native: f.place },
      interests: ints.map((x) => x.replace(/^\S+\s/, '')),
      preferences: { ageMin: aMin, ageMax: aMax, education: f.prefEdu, location: f.prefLoc },
      quote: 'Seeking a partner to walk together in faith and build a Christ-centered family.', about: f.about, paymentMode: pay
    };
    try {
      const r = await api.register(fields, { photos: [files.photo1, files.photo2, files.photo3, files.extra].filter(Boolean), idProof: files.idProof, parishLetter: files.parishLetter });
      setDone({ ...r, name: fields.name }); window.scrollTo({ top: 300, behavior: 'smooth' });
    } catch (e) { toast(e.message, 4000); if (e.status === 409) go(1); } finally { setBusy(false); }
  };

  const cls = (k, base = 'input') => base + (bad.includes(k) ? ' invalid' : '');
  const Field = ({ k, label, req, type = 'text', ph, ...rest }) => (
    <div className="field"><label>{label} {req && <span className="rq">*</span>}</label><input className={cls(k)} type={type} value={f[k]} onChange={set(k)} placeholder={ph} {...rest} /></div>
  );
  const Select = ({ k, label, req, options }) => (
    <div className="field"><label>{label} {req && <span className="rq">*</span>}</label><select className={cls(k, 'select')} value={f[k]} onChange={set(k)}>{options.map((o, idx) => { const val = Array.isArray(o) ? o[0] : o; const lbl = Array.isArray(o) ? o[1] : o; return <option key={`${val}-${idx}`} value={val}>{lbl}</option>; })}</select></div>
  );
  const Drop = ([k, icon, title, hint]) => (
    <label key={k} className={'drop' + (files[k] ? ' filled' : '') + (bad.includes(k) ? ' invalid' : '')}>
      {previews[k] && <img className="preview" src={previews[k]} alt="" />}
      <i className={icon} /><b>{files[k] && !previews[k] ? '✓ ' + files[k].name : title}</b>{hint}
      <input type="file" accept={k === 'idProof' || k === 'parishLetter' ? 'image/*,.pdf' : 'image/*'} onChange={async (e) => { const f0 = e.target.files[0]; if (!f0) return; const cf = f0.type?.startsWith('image/') ? await compressImageFile(f0, 1200, 0.82) : f0; setFiles((prev) => ({ ...prev, [k]: cf })); }} />
    </label>
  );

  return (
    <main className="page register">
      <section className="reg-hero">
        <div className="container">
          <h1>Create Your Profile<br />Begin a New Journey</h1>
          <p>Join a trusted Catholic matrimonial platform<br />by the Family Apostolate, Thrissur Archdiocese.</p>
          <div className="reg-feats">
            <div><i className="fa-solid fa-shield-heart" />Verified<br />Profiles</div><div><i className="fa-solid fa-people-group" />For Catholic<br />Families</div>
            <div><i className="fa-solid fa-lock" />Safe &amp; Secure<br />Platform</div><div><i className="fa-solid fa-heart" />Meaningful<br />Connections</div>
          </div>
        </div>
        <div className="reg-quote">“A small step today,<br />towards a blessed tomorrow.”</div>
      </section>

      <div className="container">
        <div className="card stepper">
          {STEPS.map((s, i) => (
            <div key={s} className={'step' + (step === i + 1 && !done ? ' active' : '') + (step > i + 1 || done ? ' done' : '')} onClick={() => !done && i + 1 < step && go(i + 1)}>
              <span className="n"><span>{i + 1}</span></span>{s}
            </div>
          ))}
        </div>

        <div className="reg-grid">
          <aside>
            <div className="card plan-card">
              <div className="plan-l"><h2>Subscription Plan</h2>
                <div className="plan-box"><h3>6 Months Membership</h3><div className="price">₹ 500/-</div>
                  <ul><li><i className="fa-solid fa-check" />Create and view profiles</li><li><i className="fa-solid fa-check" />Send and receive interests</li><li><i className="fa-solid fa-check" />Chat after mutual interest</li><li><i className="fa-solid fa-check" />Valid for 6 months (hold available)</li><li><i className="fa-solid fa-check" />Verified by Family Apostolate</li></ul></div></div>
              <div className="plan-art"><p>“Invest in a meaningful journey towards a blessed family life.”</p></div>
            </div>
            <div className="card req-card"><h2>Registration Requirements</h2>
              <div className="req-grid">
                <div className="req"><span className="ico"><i className="fa-solid fa-camera" /></span><div><b>Minimum 3 Photos</b>(Passport, Full Length, Any Other Photo)</div></div>
                <div className="req"><span className="ico"><i className="fa-regular fa-id-card" /></span><div><b>Valid ID Proof</b>(Aadhaar / Passport / Driving Licence etc.)</div></div>
                <div className="req"><span className="ico"><i className="fa-solid fa-file-lines" /></span><div><b>Accurate Personal Details</b>(Will be verified by admin)</div></div>
                <div className="req"><span className="ico"><i className="fa-solid fa-indian-rupee-sign" /></span><div><b>Complete Payment</b>(₹ 500 for 6 months)</div></div>
              </div></div>
          </aside>

          <div>
            {done ? (
              <div className="card form-card" style={{ textAlign: 'center', padding: '40px 30px' }}>
                <i className="fa-solid fa-circle-check" style={{ fontSize: 54, color: 'var(--green)' }} />
                <h2 className="serif wine" style={{ fontSize: 30, marginTop: 10 }}>Registration Submitted</h2>
                <p style={{ marginTop: 8 }}>Thank you, <b>{done.name}</b>. Your Profile ID is <b className="wine">{done.id}</b>.</p>
                <p className="muted" style={{ marginTop: 6 }}>The Family Apostolate office will verify your photos, ID proof and payment. You can log in with <b>{done.email}</b> once your profile is approved.</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 22 }}><Link className="btn btn-outline" to="/">Back to Home</Link><Link className="btn btn-primary" to="/login">Go to Login</Link></div>
              </div>
            ) : (
              <div className="card form-card">
                <div className="form-head"><h2>{TITLES[step - 1]}</h2><small><i className="fa-solid fa-lock" />All information is kept confidential and verified by the Family Apostolate.</small></div>

                {step === 1 && <>
                  <div className="section-band">Personal Information</div>
                  <div className="grid g3">
                    {Field({ k: 'name', label: 'Full Name', req: true, ph: 'Enter your full name' })}
                    {Select({ k: 'gender', label: 'Gender', req: true, options: [['', 'Select Gender'], 'Male', 'Female'] })}
                    {Field({ k: 'dob', label: 'Date of Birth', req: true, type: 'date' })}
                    {Select({ k: 'diocese', label: 'Diocese', req: true, options: dioceses })}
                    {Field({ k: 'place', label: 'Place', req: true, ph: 'Enter your place' })}
                    {Select({ k: 'parish', label: 'Parish', req: true, options: parishes })}
                  </div>
                  <div className="section-band">Account Information</div>
                  <div className="grid g3">
                    {Field({ k: 'email', label: 'Email Address', req: true, type: 'email', ph: 'Enter email address' })}
                    {Field({ k: 'mobile', label: 'Mobile Number', req: true, type: 'tel', ph: '10-digit mobile number' })}
                    {Field({ k: 'password', label: 'Set Password', req: true, type: 'password', ph: 'Minimum 6 characters' })}
                  </div>
                </>}

                {step === 2 && <>
                  <div className="section-band">Physical &amp; Community Details</div>
                  <div className="grid g3">
                    {Field({ k: 'height', label: 'Height (cm)', req: true, type: 'number', ph: 'e.g. 165' })}
                    {Field({ k: 'weight', label: 'Weight (kg)', type: 'number', ph: 'e.g. 60' })}
                    {Select({ k: 'bloodGroup', label: 'Blood Group', options: [['', 'Select'], 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] })}
                    {Select({ k: 'community', label: 'Rite / Community', req: true, options: ['Syro-Malabar', 'Latin', 'Syro-Malankara'] })}
                    {Select({ k: 'maritalStatus', label: 'Marital Status', req: true, options: ['Never Married', 'Widowed', 'Annulled'] })}
                    {Select({ k: 'motherTongue', label: 'Mother Tongue', options: ['Malayalam', 'English', 'Tamil', 'Other'] })}
                  </div>
                  <div className="section-band">Education &amp; Career</div>
                  <div className="grid g3">
                    {Select({ k: 'eduGroup', label: 'Highest Qualification', req: true, options: eduOptions })}
                    {Select({ k: 'job', label: 'Profession / Job', req: true, options: jobOptions })}
                    {Field({ k: 'employer', label: 'Employer / Place of Work', ph: 'Company / Hospital' })}
                    {Select({ k: 'income', label: 'Annual Income', options: ['Prefer not to say', 'Below 3 Lakh', '3 – 6 Lakh', '6 – 12 Lakh', 'Above 12 Lakh'] })}
                    {Field({ k: 'location', label: 'Current Location', req: true, ph: 'City, State / Country' })}
                    {Field({ k: 'languages', label: 'Languages Known', ph: 'English, Malayalam' })}
                  </div>
                </>}

                {step === 3 && <>
                  <div className="section-band">Family Details</div>
                  <div className="grid g3">
                    {Field({ k: 'father', label: "Father's Name & Occupation", ph: 'e.g. Thomas K. – Retd. Teacher' })}
                    {Field({ k: 'mother', label: "Mother's Name & Occupation", ph: 'e.g. Mary Thomas – Homemaker' })}
                    {Select({ k: 'familyType', label: 'Family Type', options: ['Nuclear', 'Joint'] })}
                    {Field({ k: 'brothers', label: 'Brothers (Married / Unmarried)', ph: 'e.g. 1 married' })}
                    {Field({ k: 'sisters', label: 'Sisters (Married / Unmarried)', ph: 'e.g. 1 unmarried' })}
                    {Field({ k: 'familyPhone', label: 'Family Contact Number', type: 'tel', ph: 'Parent / guardian mobile' })}
                  </div>
                  <div className="section-band">Interests &amp; Hobbies</div>
                  <div className="chips-select" style={{ margin: '0 6px 16px' }}>
                    {INTERESTS.map((x) => <label key={x}><input type="checkbox" checked={ints.includes(x)} onChange={(e) => setInts(e.target.checked ? [...ints, x] : ints.filter((y) => y !== x))} /><span>{x}</span></label>)}
                  </div>
                  <div className="section-band">Partner Preferences &amp; About Me</div>
                  <div className="grid g3">
                    {Select({ k: 'prefAge', label: 'Preferred Age', options: ['21 – 26', '24 – 30', '27 – 33', '30 – 36'] })}
                    {Select({ k: 'prefEdu', label: 'Preferred Qualification', options: ['Any', ...(look?.eduGroups || [])] })}
                    {Select({ k: 'prefLoc', label: 'Preferred Location', options: ['Within Kerala', 'Anywhere in India', 'Abroad'] })}
                  </div>
                  <div className="field" style={{ padding: '0 6px' }}><label>About Me</label><textarea className="input" rows="3" value={f.about} onChange={set('about')} placeholder="A few lines about your faith, family and what you seek in a partner…" /></div>
                </>}

                {step === 4 && <>
                  <div className="section-band">Upload Photos <small style={{ fontWeight: 400, color: 'var(--muted)' }}>(minimum 3 photos – JPG, PNG, WebP)</small></div>
                  <div className="upload-grid" style={{ padding: '0 6px 16px' }}>{PHOTO_SLOTS.map(Drop)}</div>
                  <div className="section-band">Upload Documents</div>
                  <div className="upload-grid" style={{ padding: '0 6px 6px' }}>{DOC_SLOTS.map(Drop)}</div>
                </>}

                {step === 5 && <>
                  <div className="section-band">Membership Payment</div>
                  <div className="pay-box" style={{ padding: '0 6px 16px' }}>
                    <div>{PAY.map(([v, ic, sub], i) => (
                      <label key={v} className={'pay-opt' + (pay === v ? ' sel' : '')} style={{ marginTop: i ? 10 : 0 }}>
                        <input type="radio" name="pay" checked={pay === v} onChange={() => setPay(v)} /><i className={ic + ' wine'} style={{ fontSize: 22 }} />
                        <div><b>Pay at Family Apostolate Office</b><br /><small className="muted">{sub}</small></div>
                      </label>))}</div>
                    <div>
                      <div className="summary"><b className="serif wine" style={{ fontSize: 18 }}>Order Summary</b>
                        <div><span>6 Months Membership</span><span>₹ 500.00</span></div><div><span>Validity (from approval)</span><span>{validity}</span></div>
                        <div><span>Processing fee</span><span>₹ 0.00</span></div><div className="tot"><span>Total Payable</span><span>₹ 500.00</span></div></div>
                      <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}><i className="fa-solid fa-circle-info wine" /> Membership fee of ₹ 500 is payable directly at the Family Apostolate office. Your profile becomes visible once the office verifies your details and documents.</p>
                    </div>
                  </div>
                </>}

                {step === 6 && <>
                  <div className="section-band">Profile Review</div>
                  <div style={{ padding: '0 6px 10px', display: 'grid', gridTemplateColumns: '150px 1fr', gap: 20, alignItems: 'center' }}>
                    <img src={previews.photo1 || '/img/logo.png'} alt="" style={{ borderRadius: 14, height: 170, width: 150, objectFit: 'cover', background: '#fbe3e1' }} />
                    <div>
                      <h3 className="p-name" style={{ fontSize: 28 }}>{f.name || 'Your Profile'}</h3>
                      <p className="muted" style={{ fontSize: 14, margin: '6px 0 12px' }}>Please check every detail. After submission, the office will verify your documents and payment. You will receive an email &amp; SMS once your profile is approved.</p>
                      <ul className="check-list">
                        {[[f.name && f.email, `${f.name || '—'} • ${f.gender || '—'} • ${f.diocese || '—'}`], [f.job, `${f.eduGroup || 'qualification missing'} • ${f.job || 'profession missing'}`],
                          [files.photo1 && files.photo2 && files.photo3 && files.idProof, `${['photo1', 'photo2', 'photo3'].filter((k) => files[k]).length} of 3 photos ${files.idProof ? '+ ID proof' : '(ID proof missing)'}`],
                          [true, 'Payment: pay ₹ 500 at the Family Apostolate office (admin will confirm)']].map(([ok, t], i) => (
                          <li key={i}><i className={'fa-solid ' + (ok ? 'fa-check' : 'fa-exclamation')} style={ok ? {} : { background: '#c2560c' }} />{t}</li>))}
                      </ul>
                    </div>
                  </div>
                </>}

                <div className="form-foot">
                  {step === 1 ? <label className="check"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> I agree to the <Link to="/about">Terms &amp; Conditions</Link> and <Link to="/about">Privacy Policy</Link> <span className="rq">*</span></label> : <span />}
                  <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
                    {step > 1 && <button type="button" className="btn btn-outline" onClick={() => go(step - 1)}><i className="fa-solid fa-arrow-left" /> Back</button>}
                    {step < 6 ? <button type="button" className="btn btn-primary" onClick={next} style={{ padding: '12px 28px' }}>{step === 5 ? 'Continue to Review' : 'Proceed to Next Step'} <i className="fa-solid fa-arrow-right" /></button>
                      : <button type="button" className="btn btn-primary" onClick={submit} disabled={busy} style={{ padding: '12px 28px' }}>{busy ? 'Submitting…' : 'Submit for Verification'} <i className="fa-solid fa-paper-plane" /></button>}
                  </div>
                </div>
              </div>
            )}
            <div className="trust-row">
              <div><span className="ico"><i className="fa-solid fa-lock" /></span><div><b>Safe &amp; Confidential</b>Your information is secure and not shared publicly.</div></div>
              <div><span className="ico"><i className="fa-solid fa-people-group" /></span><div><b>Verified by Family Apostolate</b>All profiles are verified after registration.</div></div>
              <div><span className="ico"><i className="fa-regular fa-heart" /></span><div><b>Only for Catholics</b>A platform for Catholic families within our community.</div></div>
              <div><span className="ico"><i className="fa-solid fa-shield-halved" /></span><div><b>Genuine Profiles</b>Help us build strong Catholic families.</div></div>
            </div>
          </div>
        </div>
      </div>
      <section className="verse-strip"><img src="/img/banner-couple.jpg" alt="" /><div><q>Let all that you do be done in love.</q><small>1 CORINTHIANS 16:14</small></div></section>
    </main>
  );
}
