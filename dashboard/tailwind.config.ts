import type { Config } from "tailwindcss";
const config: Config = {content:["./app/**/*.{ts,tsx}","./components/**/*.{ts,tsx}"],theme:{extend:{colors:{background:"#05070f",card:"#101523",accent:"#3b82f6"}}},plugins:[]};
export default config;
