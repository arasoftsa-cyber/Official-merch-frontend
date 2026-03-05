import React from "react"
import { Outlet } from "react-router-dom"
import Header from "../components/Header"

export default function PartnerLayout() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
