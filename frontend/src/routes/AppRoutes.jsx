import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import DashboardPage from "../pages/DashboardPage";
import DocumentPage from "../pages/DocumentPage";
import NotFoundPage from "../pages/NotFoundPage";
import ProtectedRoute from "./ProtectedRoute";
import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Public routes */}
            <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
            </Route>

            {/* Protected routes */}
            {/* <Route element={<ProtectedRoute />}></Route> 
            doesn't represent a URL itself.
            It acts as a security gate for its children:*/}
            <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route
                        path="/document/:documentId"
                        element={<DocumentPage />}
                    />
                </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
}

export default AppRoutes;