import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './routes/Login';
import Register from './routes/Register';
import ServicePicker from './routes/ServicePicker';
import RoutePicker from './routes/RoutePicker';
import BusConfirm from './routes/BusConfirm';
import Run from './routes/Run';
import EndOfRun from './routes/EndOfRun';
import Admin from './routes/Admin';
import AdminImportTurns from './routes/AdminImportTurns';
import AdminRouteEditor from './routes/AdminRouteEditor';
import AdminDrivers from './routes/AdminDrivers';
import AdminReplay from './routes/AdminReplay';
import Cdc from './routes/Cdc';
import { startSyncLoop } from './lib/sync';
import { startErrorReporter } from './lib/errorReporter';
import { SessionProvider } from './state/SessionProvider';
import { ShiftSetupProvider } from './state/ShiftSetupProvider';
import RequireDriver from './state/RequireDriver';
import RequireAdmin from './state/RequireAdmin';
import RequireVlineDriver from './state/RequireVlineDriver';

export default function App() {
  useEffect(() => {
    startErrorReporter();
    return startSyncLoop();
  }, []);

  return (
    <SessionProvider>
      <ShiftSetupProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/services"
            element={
              <RequireDriver>
                <ServicePicker />
              </RequireDriver>
            }
          />
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
            path="/admin/drivers"
            element={
              <RequireDriver>
                <RequireAdmin>
                  <AdminDrivers />
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
            path="/admin/replay"
            element={
              <RequireDriver>
                <RequireAdmin>
                  <AdminReplay />
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
          <Route
            path="/admin/:routeId/import-turns"
            element={
              <RequireDriver>
                <RequireAdmin>
                  <AdminImportTurns />
                </RequireAdmin>
              </RequireDriver>
            }
          />
          <Route
            path="/cdc/*"
            element={
              <RequireDriver>
                <RequireVlineDriver>
                  <Cdc />
                </RequireVlineDriver>
              </RequireDriver>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ShiftSetupProvider>
    </SessionProvider>
  );
}
