import { Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage";
import EquipmentPage from "./pages/EquipmentPage";
import EquipmentDetailPage from "./pages/EquipmentDetailPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import BookingPage from "./pages/BookingPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/equipment" element={<EquipmentPage />} />
      <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/book" element={<BookingPage />} />
    </Routes>
  );
}

export default App;