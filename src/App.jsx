import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { db } from "./services/firebase";
import Home from "./views/Home";
import Login from "./views/Login";
import Register from "./views/Register";

function App() {
  useEffect(() => {
    console.log("Firebase connected:", db);
  }, []);

  return (
    <div className="d-flex flex-column min-vh-100">
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;