import "./Navbar.css";
// import { useState } from "react";
import { Link } from "react-router-dom";

export const Navbar = () => {
  // const [activeMenu, setActiveMenu] = useState<string | null>(null);
  // const menus = {
  //   evm: ['转账', '归集'],
  //   sol: ['soon'],
  //   sui: ['soon']
  // };

  return (
    <div className="nav">
      <div className="left">
        <div className="logo">Tool</div>
        <Link to="/" className="evm">Home</Link>
        <Link to="/btc" className="evm">BTC Merge</Link>
        <Link to="/inputdata" className="evm">Input Data Generator</Link>
        <div className="sol">sol</div>
        <div className="sui"></div>
      </div>
      <div className="right">
        <div className="github">X</div>
        <div className="X">X</div>
      </div>
    </div>
  );
};