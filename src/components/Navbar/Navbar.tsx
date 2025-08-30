import React from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

export const Navbar: React.FC = () => {
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <div className="logo">Tool</div>
        <div className="navbar-links">
          <Link to="/" className="navbar-link">Home</Link>
          <Link to="/btc-merge" className="navbar-link">BTC Merge</Link>
          <Link to="/btc-split" className="navbar-link">BTC Split</Link>
          <Link to="/input-data-generator" className="navbar-link">Input Data Generator</Link>
        </div>
      </div>
      <div className="navbar-right">
        {/* 这里通常放置外部链接，例如 GitHub 和 Twitter */}
        <a href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer" className="github-link">
          GitHub
        </a>
        <a href="https://twitter.com/your-profile" target="_blank" rel="noopener noreferrer" className="other-link">
          Twitter
        </a>
      </div>
    </nav>
  );
};
