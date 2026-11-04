import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";


export const pool = mysql.createPool({
  uri: process.env.DATABASE_URL ?? "mysql://placeholder:placeholder@localhost:3306/placeholder",
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});
export const db = drizzle(pool, { schema, mode: "default" });