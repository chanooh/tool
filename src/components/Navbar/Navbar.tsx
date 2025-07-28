import "./Navbar.css"
import { useState } from "react"

export const Navbar = () => {

    const [ activeMenu, setActiveMenu ] = useState<string|null>(null)
    const menus = {
        evm: ['转账', '归集'],
        sol: ['soon'],
        sui: ['soon']
      };


    return (
        <>
            <div className="nav">

                <div className="left">
                    <div className="logo">Tool</div>
                    <div className="evm">evm</div>
                    <div className="sol">sol</div>
                    <div className="sui"></div>
                </div>

                <div className="right">
                    <div className="github">X</div>
                    <div className="X">X</div>
                </div>
            </div>
        </>
    );
}