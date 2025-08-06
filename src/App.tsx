import { Routes, Route } from "react-router-dom";
import './App.css';
import Home from './pages/Home/Home';
import BTCMerge from "./pages/BTCMerge/BTCMerge";
// import BTCSplit from "./pages/BTCSplit/BTCSplit";
import InputDataGenerator from "./pages/InputDataGenerator/InputDataGenerator";

const App = () => {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/utxomerge" element={<BTCMerge />} />
        {/* <Route path="/utxosplit" element={<BTCSplit />} /> */}
        <Route path="/inputdata" element={<InputDataGenerator />} />
      </Routes>
    </div>
  );
};

export default App;