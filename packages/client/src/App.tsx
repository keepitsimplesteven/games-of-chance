import { Routes, Route } from "react-router-dom"
import LandingPage from "./pages/LandingPage"
import RoomPage from "./pages/RoomPage"
import StyleComp from "./pages/StyleComp"
import FieldCompGrid from "./pages/FieldCompGrid"
import ViewportTestPage from "./pages/ViewportTestPage"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/style-comp" element={<StyleComp />} />
      <Route path="/field-comp" element={<FieldCompGrid />} />
      <Route path="/viewport-test" element={<ViewportTestPage />} />
      <Route path="/:roomId" element={<RoomPage />} />
    </Routes>
  )
}
