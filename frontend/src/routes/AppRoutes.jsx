import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import DashboardPage from "../pages/DashboardPage";
import DocumentPage from "../pages/DocumentPage";
import NotFoundPage from "../pages/NotFoundPage";

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route path="/login" element={<LoginPage />} />

            <Route path="/register" element={<RegisterPage />} />

            <Route path="/dashboard" element={<DashboardPage />} />

            <Route path="/document/:documentId" element={<DocumentPage />} />

            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
}

export default AppRoutes;