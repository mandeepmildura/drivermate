import { Navigate, Route, Routes } from 'react-router-dom';
import ManifestUpload from './ManifestUpload';
import RunSheet from './RunSheet';
import Form25 from './Form25';

export default function Cdc() {
  return (
    <Routes>
      <Route index element={<Navigate to="manifest" replace />} />
      <Route path="manifest" element={<ManifestUpload />} />
      <Route path="run" element={<RunSheet />} />
      <Route path="form25" element={<Form25 />} />
      <Route path="*" element={<Navigate to="manifest" replace />} />
    </Routes>
  );
}
