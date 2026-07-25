import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()


/*
|--------------------------------------------------------------------------
| Middlewares
|--------------------------------------------------------------------------
*/


app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());


/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/


app.get("/api/health", (req, res) =>{
    res.status(200).json({
        success: true, 
        message: "API working fine"
    })
})

export default app;