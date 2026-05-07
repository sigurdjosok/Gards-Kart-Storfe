import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import NorgeKart from "./NorgeKart";
import NorgeKartSvin from "./NorgeKartSvin";

function App() {
  return (
    <BrowserRouter>
      <div style={{ padding: "10px" }}>
        <Link to="/">Alle bønder</Link> |{" "}
        <Link to="/svin">Svinebønder</Link>
      </div>

      <Routes>
        <Route path="/" element={<NorgeKart />} />
        <Route path="/svin" element={<NorgeKartSvin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
