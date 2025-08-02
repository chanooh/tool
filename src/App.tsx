import { Routes, Route } from "react-router-dom";
import './App.css';
import Home from './pages/Home/Home';
import BTCMerge from "./pages/BTCMerge/BTCMerge";
import InputDataGenerator from "./pages/InputDataGenerator/InputDataGenerator";

const App = () => {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/btc" element={<BTCMerge />} />
        <Route path="/inputdata" element={<InputDataGenerator />} />
      </Routes>
    </div>
  );
};

export default App;