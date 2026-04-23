import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './routes/Login';
import RoutePicker from './routes/RoutePicker';
import BusConfirm from './routes/BusConfirm';
import Run from './routes/Run';
import EndOfRun from './routes/EndOfRun';
import Admin from './routes/Admin';
import AdminRouteEditor from './routes/AdminRouteEditor';
import { startSyncLoop } from './lib/sync';
import { SessionProvider } from './state/SessionProvider';
import { ShiftSetupProvider } from './state/ShiftSetupProvider';
import RequireDriver from './state/RequireDriver';
import RequireAdmin from './state/RequireAdmin';

export default function App() {
  useEffect(() => startSyncLoop(), []);

  return (
    <SessionProvider>
      <ShiftSetupProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/routes"
            element={
              <RequireDriver>
                <RoutePicker />
              </RequireDriver>
            }
          />
          <Route
            path="/bus"
            element={
              <RequireDriver>
                <BusConfirm />
              </RequireDriver>
            }
          />
          <Route
            path="/run"
            element={
              <RequireDriver>
                <Run />
              </RequireDriver>
            }
          />
          <Route
            path="/run/end"
            element={
              <RequireDriver>
                <EndOfRun />
              </RequireDriver>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireDriver>
                <RequireAdmin>
                  <Admin />
                </RequireAdmin>
              </RequireDriver>
            }
          />
          <Route
            path="/admin/new"
            element={
              <RequireDriver>
                <RequireAdmin>
                  <AdminRouteEditor />
                </RequireAdmin>
              </RequireDriver>
            }
          />
          <Route
            path="/admin/:routeId"
            element={
              <RequireDriver>
                <RequireAdmin>
                  <AdminRouteEditor />
                </RequireAdmin>
              </RequireDriver>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ShiftSetupProvider>
    </SessionProvider>
  );
}
