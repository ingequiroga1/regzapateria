import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extraerIdHoja } from "./hoja-id";

export type ItemCatalogo = { modelo: string; costo: number; precio: number };

export type Venta = {
  fecha: string;
  cliente: string;
  modelo: string;
  talla: string;
  color: string;
  cantidad: number;
  precio: number;
  costo: number;
  descuento: number;
  total: number;
  metodoPago: string;
  vendedor: string;
};

function scriptUrl() {
  const url = process.env["GOOGLE_SCRIPT_URL"];
  if (!url) throw new Error("Falta configurar la URL del Google Script (GOOGLE_SCRIPT_URL).");
  return url;
}

type Ctx = { supabase: any; userId: string };

async function hojaDe(ctx: Ctx): Promise<string> {
  const { data, error } = await ctx.supabase
    .from("hojas_usuario")
    .select("spreadsheet_id")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) throw new Error("No se pudo leer el archivo asignado a tu cuenta.");
  if (!data?.spreadsheet_id) throw new Error("Tu cuenta aún no tiene un Google Sheet asignado. Configúralo arriba.");
  return data.spreadsheet_id as string;
}

async function getJson(url: string) {
  const res = await fetch(url, { redirect: "follow" });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google Script respondió ${res.status}: ${text.slice(0, 200)}`);
  let json: { ventas?: Venta[]; catalogo?: (ItemCatalogo | string)[]; error?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("La respuesta del Google Script no es JSON válido.");
  }
  if (json.error) throw new Error(json.error);
  return json;
}

export const obtenerHoja = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("hojas_usuario")
      .select("spreadsheet_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data?.spreadsheet_id ?? null;
  });

export const guardarHoja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { valor: string }) => {
    const id = extraerIdHoja(v.valor ?? "");
    if (!id) throw new Error("Pega el enlace o el ID de tu Google Sheet.");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("hojas_usuario")
      .upsert({ user_id: context.userId, spreadsheet_id: data.id, updated_at: new Date().toISOString() });
    if (error) throw new Error("No se pudo guardar el archivo.");
    return data.id;
  });

export const listarVentas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const id = await hojaDe(context);
    const json = await getJson(`${scriptUrl()}?sheetId=${encodeURIComponent(id)}`);
    return (json.ventas ?? []) as Venta[];
  });

export const listarCatalogo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const id = await hojaDe(context);
    const json = await getJson(`${scriptUrl()}?hoja=catalogo&sheetId=${encodeURIComponent(id)}`);
    return (json.catalogo ?? []).map((c) =>
      typeof c === "string" ? { modelo: c, costo: 0, precio: 0 } : { modelo: String(c.modelo), costo: Number(c.costo), precio: Number(c.precio) || 0 },
    ) as ItemCatalogo[];
  });

export const registrarVenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: Omit<Venta, "fecha" | "total" | "vendedor">) => {
    if (!v.modelo?.trim()) throw new Error("El modelo es obligatorio");
    if (!v.talla?.toString().trim()) throw new Error("La talla es obligatoria");
    if (!(v.cantidad > 0)) throw new Error("Cantidad inválida");
    if (!(v.precio >= 0)) throw new Error("Precio inválido");
    if (!(v.descuento >= 0)) throw new Error("Descuento inválido");
    if (v.descuento > v.cantidad * v.precio) throw new Error("El descuento no puede ser mayor que el subtotal");
    return v;
  })
  .handler(async ({ data, context }) => {
    // console.log("registrarVenta", data, context.userId, context.claims);
    const id = await hojaDe(context);
    const venta: Venta = {
      ...data,
      fecha: new Date().toISOString(),
      total: Math.round((data.cantidad * data.precio - data.descuento) * 100) / 100,
      vendedor: (context.claims as { email?: string }).email ?? context.userId,
    };
    const res = await fetch(`${scriptUrl()}?sheetId=${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...venta, sheetId: id }),
      redirect: "follow",
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Google Script respondió ${res.status}: ${text.slice(0, 200)}`);
    try {
      const j = JSON.parse(text);
      if (j.error) throw new Error(j.error);
    } catch (e) {
      if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
    }
    return venta;
  });
