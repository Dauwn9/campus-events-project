"use client";
import Link from "next/link";
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <div className="page-container workspace"><div className="workspace-empty"><h1 className="text-2xl font-semibold">Не удалось загрузить страницу</h1><p>Данные временно недоступны. Попробуйте ещё раз.</p><button onClick={reset} className="workspace-button">Повторить попытку</button><Link href="/" className="block mt-5 text-sm text-primary">Вернуться к афише</Link></div></div>;}
