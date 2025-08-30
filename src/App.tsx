import { Routes, Route } from "react-router-dom";
import './App.css';
import Home from './pages/Home/Home';
import BTCMerge from "./pages/BTCMerge/BTCMerge";
import BTCSplit from "./pages/BTCSplit/BTCSplit";
import InputDataGenerator from "./pages/InputDataGenerator/InputDataGenerator";
import {Navbar} from "./components/Navbar/Navbar"; 
const App = () => {
  return (
    <div>
      <Navbar />
      <div className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/btc-merge" element={<BTCMerge />} />
          <Route path="/btc-split" element={<BTCSplit />} />
          <Route path="/input-data-generator" element={<InputDataGenerator />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;