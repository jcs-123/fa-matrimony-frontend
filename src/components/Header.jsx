import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fmt } from '../lib/utils';

export const NAV = [['Home', '/'], ['Search', '/search'], ['Magazine', '/magazine'], ['Success Stories', '/stories'], ['About Us', '/about'], ['Location', '/location'], ['Contact', '/contact']];

export function Brand({ footer }) {
  return (
    <Link className="brand" to="/">
      <img src="/img/logo.png" alt="Family Apostolate logo" />
      <div>
        <div className="t1">FAMILY APOSTOLATE<br />THRISSUR ARCHDIOCESE</div>
        <div className="t2">{footer ? <>Building Families &nbsp;•&nbsp; Building a Holy Tomorrow</> : <>BUILDING FAMILIES &nbsp;•&nbsp; BUILDING A HOLY TOMORROW</>}</div>
      </div>
    </Link>
  );
}

export default function Header() {
  const { isMember, isAdmin, user, summary, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const ref = useRef();
  useEffect(() => { setMenu(false); setNavOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setMenu(false);
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, []);
  const bell = (summary?.unread || 0) + (summary?.likedMe || 0) + (summary?.notices || 0);
  const doLogout = async () => { await logout(); nav('/login'); };
  const todayStr = new Date().toISOString().slice(0, 10);
  const isExpired = isMember && (user?.status === 'expired' || (user?.expiryDate && user.expiryDate < todayStr));

  return (
    <header className="site-header">
      <div className="container">
        <Brand />
        <nav className={'nav' + (navOpen ? ' open' : '')}>
          {NAV.map(([n, to]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>{n}</NavLink>)}
        </nav>
        <button className="menu-toggle" aria-label="Menu" onClick={() => setNavOpen((v) => !v)}><i className="fa-solid fa-bars" /></button>
        <div className="header-actions">
          {isMember && (
            <>
              {isExpired ? (
                <Link className="btn btn-primary" to="/renewal" style={{ padding: '6px 14px', fontSize: 13, background: '#7c1431' }}>
                  <i className="fa-solid fa-rotate" /> Renew Plan
                </Link>
              ) : (
                <Link className="bell" to={summary?.unread ? '/chat' : '/my-profile'} title={`${bell} new`}><i className="fa-regular fa-bell" />{bell > 0 && <b>{bell}</b>}</Link>
              )}
              <div className={'user-menu' + (menu ? ' open' : '')} ref={ref}>
                <button className="user-chip" type="button" onClick={() => setMenu((v) => !v)}>
                  <img src={user.photos?.[0] || '/img/logo.png'} alt="" /><span>{user.name}</span><i className="fa-solid fa-chevron-down" style={{ fontSize: 11, marginLeft: 10 }} />
                </button>
                <div className="um-drop">
                  <Link to="/my-profile"><i className="fa-regular fa-user" />My Profile</Link>
                  {isExpired && (
                    <Link to="/renewal" style={{ color: '#7c1431', fontWeight: 600 }}>
                      <i className="fa-solid fa-rotate" />Renew Plan (Expired)
                    </Link>
                  )}
                  {!isExpired && user.status !== 'on_hold' && <>
                    <Link to="/match"><i className="fa-solid fa-heart" />Match</Link>
                    <Link to="/chat"><i className="fa-regular fa-comments" />Messages{summary?.unread > 0 && <b className="um-n">{summary.unread}</b>}</Link>
                    <Link to="/search"><i className="fa-solid fa-magnifying-glass" />Search</Link>
                  </>}
                  <Link to="/my-profile#account"><i className="fa-solid fa-gear" />Account &amp; Hold</Link>
                  <div className="um-sub">{isExpired ? `Plan expired on ${fmt(user.expiryDate)}` : user.status === 'on_hold' ? `On hold till ${fmt(user.hold?.until)}` : `Subscription till ${fmt(user.expiryDate)}`}</div>
                  <a href="#logout" onClick={(e) => { e.preventDefault(); doLogout(); }}><i className="fa-solid fa-right-from-bracket" />Logout</a>
                </div>
              </div>
            </>
          )}
          {isAdmin && (
            <>
              <Link className="btn btn-primary" to="/admin"><i className="fa-solid fa-gauge-high" /><span>Admin Panel</span></Link>
              <button className="btn btn-outline" onClick={doLogout}><i className="fa-solid fa-right-from-bracket" /><span>Logout</span></button>
            </>
          )}
          {!isMember && !isAdmin && (
            <>
              <Link className="btn btn-outline" to="/login"><i className="fa-regular fa-user" /><span>Login</span></Link>
              <Link className="btn btn-primary" to="/register"><i className="fa-solid fa-heart-circle-check" /><span>Register</span></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
