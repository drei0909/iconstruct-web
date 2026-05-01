import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

function AuthLayout() {
  return (
    <>
      <Navbar forceScrolled hideBar />
      <Outlet />
    </>
  );
}

export default AuthLayout;