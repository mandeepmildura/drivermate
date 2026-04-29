import { Navigate, Route, Routes } from 'react-router-dom';
import ManifestUpload from './ManifestUpload';
import CdcRoutePicker from './RoutePicker';
import RunSheet from './RunSheet';
import Form25 from './Form25';

export default function Cdc() {
  return (
    <Routes>
      <Route index element={<Navigate to="routes" replace />} />
      <Route path="routes" element={<CdcRoutePicker />} />
      <Route path="manifest" element={<ManifestUpload />} />
      <Route path="run" element={<RunSheet />} />
      <Route path="form25" element={<Form25 />} />
      <Route path="*" element={<Navigate to="routes" replace />} />
    </Routes>
  );
}
