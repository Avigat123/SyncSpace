import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
//Without the hook, every component would have to write:
//const { user, loading } = useContext(AuthContext);
//);
export default function useAuth() {
    return useContext(AuthContext);
}