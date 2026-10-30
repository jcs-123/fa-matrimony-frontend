import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api';

const TITLES = [
  ['/admin/members', 'Registrations', 'All members – sorted by registration date'],
  ['/admin/verify', 'Verify Registration', 'Check details, photos, ID proof and payment before approving'],
  ['/admin/lookups', 'Job, Parish & Education', 'Add, edit or remove Jobs, Parishes, Education & Dioceses used in dropdowns'],
  ['/admin/holds', 'Hold Requests', 'Members who asked to pause their account for a period'],
  ['/admin/married', 'Married – Delete Accounts', 'Members who reported their marriage – verify and delete'],
  ['/admin/reports', 'Monthly Reports', 'Active, inactive, on-hold, married and pending members – month by month'],
  ['/admin/moderation', 'Reports & Blocks', 'Reported users with reasons, flagged messages, and platform block list'],
  ['/admin/enquiries', 'Enquiries', 'Messages from the Contact page and success-story submissions'],
  ['/admin/stories', 'Success Stories', 'Manage published couple stories and testimonials directly in database'],
  ['/admin', 'Dashboard', new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' • Overview']
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const [sum, setSum] = useState(null);
  const loadSum = () => api.adminSummary().then(setSum).catch(() => {});
  useEffect(() => { loadSum(); }, [loc.pathname, loc.search]);
  useEffect(() => { window.addEventListener('fa:admin-changed', loadSum); return () => window.removeEventListener('fa:admin-changed', loadSum); }, []);

  const items = [
    ['/admin', 'fa-solid fa-gauge-high', 'Dashboard', null, true],
    ['/admin/members', 'fa-solid fa-users', 'Registrations', sum?.counts?.pending],
    ['/admin/verify', 'fa-solid fa-user-check', 'Verify Profile'],
    ['/admin/lookups', 'fa-solid fa-list-check', 'Job, Parish & Edu'],
    ['/admin/holds', 'fa-solid fa-circle-pause', 'Hold Requests', sum?.holdRequests],
    ['/admin/married', 'fa-solid fa-ring', 'Married – Delete', sum?.marriedToDelete],
    ['/admin/reports', 'fa-solid fa-chart-column', 'Monthly Reports'],
    ['/admin/moderation', 'fa-solid fa-shield-halved', 'Reports & Blocks', sum?.reports],
    ['/admin/enquiries', 'fa-regular fa-envelope', 'Enquiries', sum?.openEnquiries],
    ['/admin/stories', 'fa-solid fa-heart', 'Success Stories', sum?.totalStories]
  ];
  return (
    <div className="admin">
      <div className="adm">
        <aside className="side">
          <NavLink className="brand" to="/admin"><img src="/img/logo.png" alt="" /><div><div className="t1">FAMILY APOSTOLATE<br />MATRIMONY ADMIN</div><div className="t2">THRISSUR ARCHDIOCESE</div></div></NavLink>
          <div className="sec">MANAGE</div>
          {items.map(([to, ic, label, n, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => 'nav-i' + (isActive ? ' on' : '')}>
              <i className={ic} />{label}{n > 0 && <span className="cnt">{n}</span>}
            </NavLink>
          ))}
          <div className="sec">QUICK LINKS</div>
          <a className="nav-i" href="/" target="_blank" rel="noreferrer"><i className="fa-solid fa-globe" />View Website</a>
          <a className="nav-i" href="#logout" onClick={async (e) => { e.preventDefault(); await logout(); nav('/login?role=admin'); }}><i className="fa-solid fa-right-from-bracket" />Logout</a>
          <div className="verse">“Unless the Lord builds the house, those who build it labour in vain.”<small>PSALM 127:1</small></div>
        </aside>
        <main className="main">
          <div className="topbar">
            {(() => { const t = TITLES.find(([p]) => loc.pathname.startsWith(p)); return <div className="adm-title"><h1>{t[1]}</h1><div className="sub">{t[2]}</div></div>; })()}
            <div className="admin-chip" style={{ marginLeft: 'auto' }}>
              <span className="av">FA</span><div>{user?.name}<small>{user?.role} • Family Apostolate</small></div>
            </div>
          </div>
          <Outlet context={{ summary: sum, reloadSummary: loadSum }} />
        </main>
      </div>
    </div>
  );
}

export const adminChanged = () => window.dispatchEvent(new Event('fa:admin-changed'));
