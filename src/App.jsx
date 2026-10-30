import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import PublicLayout from './components/PublicLayout';
import AdminLayout from './components/AdminLayout';
import { RequireAdmin, RequireMember } from './components/Guards';
import Home from './pages/public/Home';
import Magazine from './pages/public/Magazine';
import Article from './pages/public/Article';
import Stories from './pages/public/Stories';
import About from './pages/public/About';
import Location from './pages/public/Location';
import Contact from './pages/public/Contact';
import Login from './pages/public/Login';
import Register from './pages/public/Register';
import NotFound from './pages/public/NotFound';
import MyProfile from './pages/member/MyProfile';
import Renewal from './pages/member/Renewal';
import Search from './pages/member/Search';
import Match from './pages/member/Match';
import ProfileView from './pages/member/ProfileView';
import ProfileDetails from './pages/member/ProfileDetails';
import Chat from './pages/member/Chat';
import Dashboard from './pages/admin/Dashboard';
import Members from './pages/admin/Members';
import Verify from './pages/admin/Verify';
import Holds from './pages/admin/Holds';
import Married from './pages/admin/Married';
import Reports from './pages/admin/Reports';
import Enquiries from './pages/admin/Enquiries';
import AdminStories from './pages/admin/Stories';
import Moderation from './pages/admin/Moderation';
import Lookups from './pages/admin/Lookups';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/magazine" element={<Magazine />} />
          <Route path="/magazine/:id" element={<Article />} />
          <Route path="/stories" element={<Stories />} />
          <Route path="/about" element={<About />} />
          <Route path="/location" element={<Location />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {/* member area */}
          <Route path="/my-profile" element={<RequireMember allowHold allowExpired><MyProfile /></RequireMember>} />
          <Route path="/renewal" element={<RequireMember allowHold allowExpired><Renewal /></RequireMember>} />
          <Route path="/search" element={<RequireMember><Search /></RequireMember>} />
          <Route path="/match" element={<RequireMember><Match /></RequireMember>} />
          <Route path="/profile/:id" element={<RequireMember><ProfileView /></RequireMember>} />
          <Route path="/profile/:id/details" element={<RequireMember><ProfileDetails /></RequireMember>} />
          <Route path="/chat" element={<RequireMember><Chat /></RequireMember>} />
          <Route path="/chat/:id" element={<RequireMember><Chat /></RequireMember>} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<Dashboard />} />
          <Route path="members" element={<Members />} />
          <Route path="verify" element={<Verify />} />
          <Route path="verify/:id" element={<Verify />} />
          <Route path="lookups" element={<Lookups />} />
          <Route path="holds" element={<Holds />} />
          <Route path="married" element={<Married />} />
          <Route path="reports" element={<Reports />} />
          <Route path="moderation" element={<Moderation />} />
          <Route path="enquiries" element={<Enquiries />} />
          <Route path="stories" element={<AdminStories />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </>
  );
}
