import { Routes, Route } from "react-router-dom";
import './App.css'
import Home from './pages/Home/Home'
import BTCMerge from "./pages/BTCMerge/BTCMerge";

const App = () => {
 
  return (
    <div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/btc" element={<BTCMerge />} />
      </Routes>
    </div>
  );
 
};

export default App;